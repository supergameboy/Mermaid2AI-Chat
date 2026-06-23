/**
 * MindmapDB — 官方 mermaid `mindmapDb.ts` 的纯 TypeScript 移植
 *
 * 单一职责：jison parser 调用此类的实例方法收集 AST 数据，并通过 getData() 返回 MindmapDBData
 *
 * 与官方的差异:
 *   - 移除 getConfig() 调用（使用默认值常量替代）
 *   - 移除 D3Element / getElementById / setElementForId（DOM 相关）
 *   - 移除 getUserDefinedConfig（布局由渲染层负责）
 *   - 移除 sanitizeText 依赖（简化为 trim，HTML 转义由渲染层负责）
 *   - 移除 log 依赖（解析层不输出日志）
 *   - 移除 v4 uuid 依赖（不需要生成 diagramId）
 *   - 移除 generateEdges 方法（edges 改为渲染时从 parentId 派生，单一数据源）
 *   - flattenNodes 输出 MindmapLayoutNode（含 parentId 字段，用于派生 edges）
 *   - 适配 TypeScript 严格模式（禁止 any，禁止 ! 非空断言）
 *
 * 数据流:
 *   jison parser → MindmapDB.addNode(level, id, descr, type) → 树形结构
 *     → MindmapDB.decorateNode({ class, icon }) → 装饰最后一个节点
 *   → MindmapDB.getData() → assignSections + flattenNodes → MindmapLayoutNode[]
 *
 * 注意:
 *   - jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
 *   - jison 通过 yy.methodName() 调用 MindmapDB 实例方法
 */

import type { MindmapDBNode, MindmapLayoutNode, MindmapDBData, MindmapNodeTypeValue } from './mindmap-types.js';
import { MindmapNodeTypeConst } from './mindmap-types.js';
import {
  MAX_SECTIONS,
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_PADDING,
  DEFAULT_MAX_NODE_WIDTH,
  DEFAULT_LOOK,
  DEFAULT_LABEL_TYPE,
  CSS_MINDMAP_NODE,
  CSS_SECTION_ROOT,
  CSS_SECTION_PREFIX,
  CSS_SECTION_ROOT_LEGACY,
} from './mindmap-constants.js';

/** 简化的 sanitizeText（去除首尾空白） */
function sanitizeText(text: string): string {
  return text.trim();
}

/** 节点类型 → 形状字符串映射（对齐官方 getShapeFromType） */
function getShapeFromType(type: MindmapNodeTypeValue): string {
  switch (type) {
    case MindmapNodeTypeConst.CIRCLE:
      return 'mindmapCircle';
    case MindmapNodeTypeConst.RECT:
      return 'rect';
    case MindmapNodeTypeConst.ROUNDED_RECT:
      return 'rounded';
    case MindmapNodeTypeConst.CLOUD:
      return 'cloud';
    case MindmapNodeTypeConst.BANG:
      return 'bang';
    case MindmapNodeTypeConst.HEXAGON:
      return 'hexagon';
    case MindmapNodeTypeConst.DEFAULT:
    case MindmapNodeTypeConst.NO_BORDER:
    default:
      return 'defaultMindmapNode';
  }
}

/** 节点类型 → 字符串（对齐官方 type2Str，用于 CSS 类名） */
function type2Str(type: MindmapNodeTypeValue): string {
  switch (type) {
    case MindmapNodeTypeConst.DEFAULT:
    case MindmapNodeTypeConst.NO_BORDER:
      return 'no-border';
    case MindmapNodeTypeConst.RECT:
      return 'rect';
    case MindmapNodeTypeConst.ROUNDED_RECT:
      return 'rounded-rect';
    case MindmapNodeTypeConst.CIRCLE:
      return 'circle';
    case MindmapNodeTypeConst.CLOUD:
      return 'cloud';
    case MindmapNodeTypeConst.BANG:
      return 'bang';
    case MindmapNodeTypeConst.HEXAGON:
      return 'hexgon'; // cspell: disable-line（对齐官方拼写）
    default:
      return 'no-border';
  }
}

export class MindmapDB {
  private nodes: MindmapDBNode[] = [];
  private count = 0;
  private baseLevel?: number;
  /** 父节点栈（用于 flattenNodes 时构建 parentId） */
  private parentStack: MindmapDBNode[] = [];
  private accTitleValue: string | undefined;
  private accDescriptionValue: string | undefined;

  public readonly nodeType: typeof MindmapNodeTypeConst;

  constructor() {
    this.nodeType = MindmapNodeTypeConst;
    this.clear();
    // jison 通过 yy.methodName() 调用，必须绑定 this
    this.getType = this.getType.bind(this);
    this.getParent = this.getParent.bind(this);
    this.getMindmap = this.getMindmap.bind(this);
    this.addNode = this.addNode.bind(this);
    this.decorateNode = this.decorateNode.bind(this);
    this.getLogger = this.getLogger.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.getAccTitle = this.getAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
    this.getAccDescription = this.getAccDescription.bind(this);
  }

  public clear(): void {
    this.nodes = [];
    this.count = 0;
    this.baseLevel = undefined;
    this.parentStack = [];
    this.accTitleValue = undefined;
    this.accDescriptionValue = undefined;
  }

  /**
   * 找到 level 小于当前 level 的最近节点作为父节点
   * 对齐官方 getParent 逻辑
   */
  public getParent(level: number): MindmapDBNode | null {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      if (this.nodes[i].level < level) {
        return this.nodes[i];
      }
    }
    return null;
  }

  /** 获取 root 节点（第一个节点） */
  public getMindmap(): MindmapDBNode | null {
    return this.nodes.length > 0 ? this.nodes[0] : null;
  }

  /**
   * 添加节点（jison 调用）
   *
   * @param level - 缩进层级（原始值，会减去 baseLevel）
   * @param id - 用户定义的 nodeId
   * @param descr - 节点描述（label）
   * @param type - 节点类型（MindmapNodeTypeConst 值）
   */
  public addNode(level: number, id: string, descr: string, type: MindmapNodeTypeValue): void {
    let isRoot = false;

    if (this.nodes.length === 0) {
      this.baseLevel = level;
      level = 0;
      isRoot = true;
    } else if (this.baseLevel !== undefined) {
      level = level - this.baseLevel;
      isRoot = false;
    }

    let padding = DEFAULT_NODE_PADDING;
    // 对齐官方：rect/rounded/hexagon 的 padding 翻倍
    switch (type) {
      case this.nodeType.ROUNDED_RECT:
      case this.nodeType.RECT:
      case this.nodeType.HEXAGON:
        padding *= 2;
        break;
    }

    const node: MindmapDBNode = {
      id: this.count++,
      nodeId: sanitizeText(id),
      level,
      descr: sanitizeText(descr),
      type,
      children: [],
      width: DEFAULT_MAX_NODE_WIDTH,
      padding,
      isRoot,
    };

    const parent = this.getParent(level);
    if (parent) {
      parent.children.push(node);
      this.nodes.push(node);
    } else {
      if (isRoot) {
        this.nodes.push(node);
      } else {
        // 对齐官方：无父节点且非 root → 抛错（多 root 检测）
        throw new Error(
          `There can be only one root. No parent could be found for ("${node.descr}")`,
        );
      }
    }
  }

  /**
   * 根据 startStr/endStr 判断节点类型
   * 对齐官方 getType 逻辑
   */
  public getType(startStr: string, endStr: string): MindmapNodeTypeValue {
    switch (startStr) {
      case '[':
        return this.nodeType.RECT;
      case '(':
        return endStr === ')' ? this.nodeType.ROUNDED_RECT : this.nodeType.CLOUD;
      case '((':
        return this.nodeType.CIRCLE;
      case ')':
        return this.nodeType.CLOUD;
      case '))':
        return this.nodeType.BANG;
      case '{{':
        return this.nodeType.HEXAGON;
      default:
        return this.nodeType.DEFAULT;
    }
  }

  /**
   * 装饰最后一个添加的节点（icon/class）
   * 对齐官方 decorateNode 逻辑
   */
  public decorateNode(decoration?: { class?: string; icon?: string }): void {
    if (!decoration) {
      return;
    }

    const node = this.nodes[this.nodes.length - 1];
    if (!node) {
      return;
    }
    if (decoration.icon) {
      node.icon = sanitizeText(decoration.icon);
    }
    if (decoration.class) {
      node.class = sanitizeText(decoration.class);
    }
  }

  /** 节点类型 → 字符串（对齐官方 type2Str） */
  public type2Str(type: MindmapNodeTypeValue): string {
    return type2Str(type);
  }

  /**
   * 递归分配 section 编号
   *
   * 对齐官方 assignSections 逻辑:
   *   - root 节点 section = undefined
   *   - root 的直接子节点按索引 % (MAX_SECTIONS - 1) 分配
   *   - 其他节点继承父节点的 section
   *
   * @param node - 当前节点
   * @param sectionNumber - 当前 section 编号（root 为 undefined）
   */
  public assignSections(node: MindmapDBNode, sectionNumber?: number): void {
    if (node.level === 0) {
      node.section = undefined;
    } else {
      node.section = sectionNumber;
    }

    if (node.children) {
      for (const [index, child] of node.children.entries()) {
        const childSectionNumber =
          node.level === 0 ? index % (MAX_SECTIONS - 1) : sectionNumber;
        this.assignSections(child, childSectionNumber);
      }
    }
  }

  /**
   * 将树形结构扁平化为节点数组
   *
   * 对齐官方 flattenNodes 逻辑，新增 parentId 字段用于派生 edges
   *
   * @param node - 当前节点
   * @param processedNodes - 收集节点的数组
   * @param parentId - 父节点 id（用于派生 edges）
   */
  public flattenNodes(
    node: MindmapDBNode,
    processedNodes: MindmapLayoutNode[],
    parentId?: string,
  ): void {
    // 构建 CSS 类名
    const cssClasses: string[] = [CSS_MINDMAP_NODE];

    if (node.isRoot === true) {
      cssClasses.push(CSS_SECTION_ROOT, CSS_SECTION_ROOT_LEGACY);
    } else if (node.section !== undefined) {
      cssClasses.push(`${CSS_SECTION_PREFIX}${node.section}`);
    }

    if (node.class) {
      cssClasses.push(node.class);
    }

    const classes = cssClasses.join(' ');

    const processedNode: MindmapLayoutNode = {
      id: node.id.toString(),
      domId: 'node_' + node.id.toString(),
      label: node.descr,
      labelType: DEFAULT_LABEL_TYPE,
      isGroup: false,
      shape: getShapeFromType(node.type),
      width: node.width,
      height: node.height ?? DEFAULT_NODE_HEIGHT,
      padding: node.padding,
      cssClasses: classes,
      cssStyles: [],
      icon: node.icon,
      x: node.x,
      y: node.y,
      level: node.level,
      nodeId: node.nodeId,
      type: node.type,
      section: node.section,
      ...(parentId !== undefined ? { parentId } : {}),
      ...(node.isRoot ? { isRoot: true } : {}),
      ...(node.class ? { class: node.class } : {}),
    };

    processedNodes.push(processedNode);

    // 递归处理子节点，传入当前节点 id 作为 parentId
    if (node.children) {
      for (const child of node.children) {
        this.flattenNodes(child, processedNodes, node.id.toString());
      }
    }
  }

  /**
   * 获取结构化数据（jison 解析完成后调用）
   *
   * 对齐官方 getData 逻辑，移除 edges 生成（edges 由渲染层从 parentId 派生）
   *
   * @returns MindmapDBData（含 nodes 和 config）
   */
  public getData(): MindmapDBData {
    const mindmapRoot = this.getMindmap();

    if (!mindmapRoot) {
      return {
        nodes: [],
        config: { look: DEFAULT_LOOK },
      };
    }

    // 分配 section 编号
    this.assignSections(mindmapRoot);

    // 转换为扁平节点数组
    const processedNodes: MindmapLayoutNode[] = [];
    this.flattenNodes(mindmapRoot, processedNodes);

    return {
      nodes: processedNodes,
      config: { look: DEFAULT_LOOK },
    };
  }

  // ============================================================
  // Accessibility（对齐官方 commonDb 方法）
  // ============================================================

  public setAccTitle(title: string): void {
    this.accTitleValue = title;
  }

  public getAccTitle(): string | undefined {
    return this.accTitleValue;
  }

  public setAccDescription(desc: string): void {
    this.accDescriptionValue = desc;
  }

  public getAccDescription(): string | undefined {
    return this.accDescriptionValue;
  }

  /** 暴露 logger（jison 文法引用，本移植版返回空对象） */
  public getLogger(): {
    trace: (..._args: unknown[]) => void;
    debug: (..._args: unknown[]) => void;
    info: (..._args: unknown[]) => void;
    warn: (..._args: unknown[]) => void;
    error: (..._args: unknown[]) => void;
  } {
    return {
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }
}
