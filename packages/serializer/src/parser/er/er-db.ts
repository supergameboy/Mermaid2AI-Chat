/**
 * ErDB — 官方 mermaid `erDb.ts` 的纯 TypeScript 移植
 *
 * 单一职责：jison parser 调用此类的实例方法收集 AST 数据
 *
 * 与官方的差异:
 *   - 移除 getConfig 依赖（使用默认配置，不做 securityLevel/look 相关处理）
 *   - 移除 common.sanitizeText（HTML 转义由渲染层负责）
 *   - 移除 commonClear/setAccTitle 等 commonDb 依赖（在本地实现）
 *   - 移除 setDiagramTitle/getDiagramTitle（er 图不使用 diagramTitle）
 *   - 移除 getConfig（er 配置由渲染层负责）
 *   - 移除 getData() 中的 nodes/edges 构建（由 er-parser.ts 的 mapAstToCanvasState 负责）
 *   - 移除 log 依赖（解析层不输出日志）
 *   - 移除 getEdgeId 依赖（边 ID 由 er-parser.ts 生成）
 *   - 适配 TypeScript 严格模式（禁止 any，禁止 ! 非空断言）
 *   - 保留 addEntity/addAttributes/addRelationship/setDirection/addCssStyles/addClass/
 *     setClass/addSubGraph/getCompiledStyles/makeUniq/subgraphNodeCache/sanitizeText/
 *     sanitizeNodeLabelType 逻辑
 *   - 保留 subgraphDepth 公共字段（jison yy 动态访问）
 *   - getData() 返回 ERAST（原始数据结构，非渲染输出）
 *
 * 数据流:
 *   jison parser → ErDB.addEntity/addAttributes/addRelationship/... → ErDB.getData() → ERAST
 *
 * 注意:
 *   - jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
 *   - Cardinality/Identification 作为实例属性挂载，供 jison 语法动作引用
 */

import type {
  EntityNode,
  Attribute,
  Relationship,
  RelSpec,
  EntityClass,
  ErSubGraph,
  ErDBYY,
} from './types.js';
import type { ERAST } from '../../ast/er-ast.js';
import { CARDINALITY, IDENTIFICATION } from './constants.js';

// ============================================================
// 内部类型
// ============================================================

/** jison 语法中 subgraph document 的列表项（可能是字符串或方向对象） */
type SubGraphListItem = string | { stmt: string; value: string };

/** jison 语法中 attribute 的输入类型（keys/comment 可选，由 addAttributes 初始化） */
interface InputAttribute {
  type: string;
  name: string;
  keys?: string[];
  comment?: string;
}

/** jison 语法中 addSubGraph 的 title 参数类型 */
interface SubGraphTitle {
  text: string;
  type?: string;
}

// ============================================================
// ErDB 类
// ============================================================

/**
 * ErDB — er 解析数据收集器
 *
 * 实例方法被 jison parser 通过 `yy.methodName()` 调用
 * 所有 jison 调用的方法在构造函数中 bind，确保 this 指向正确
 */
export class ErDB implements ErDBYY {
  private entities = new Map<string, EntityNode>();
  private relationships: Relationship[] = [];
  private classes = new Map<string, EntityClass>();
  private subGraphs: ErSubGraph[] = [];
  private subGraphLookup = new Map<string, ErSubGraph>();
  private subCount = 0;
  private direction = 'TB';
  private accTitleValue: string | undefined;
  private accDescriptionValue: string | undefined;

  /** jison yy 动态读写的 subgraph 深度（公共字段） */
  public subgraphDepth = 0;

  // 常量作为实例属性挂载（jison 通过 yy.Cardinality / yy.Identification 访问）
  public readonly Cardinality = CARDINALITY;
  public readonly Identification = IDENTIFICATION;

  constructor() {
    // jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
    this.addEntity = this.addEntity.bind(this);
    this.addAttributes = this.addAttributes.bind(this);
    this.addRelationship = this.addRelationship.bind(this);
    this.setDirection = this.setDirection.bind(this);
    this.addCssStyles = this.addCssStyles.bind(this);
    this.addClass = this.addClass.bind(this);
    this.setClass = this.setClass.bind(this);
    this.addSubGraph = this.addSubGraph.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);

    this.clear();
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /** 重置状态 */
  public clear(): void {
    this.entities = new Map();
    this.classes = new Map();
    this.relationships = [];
    this.subGraphs = [];
    this.subGraphLookup = new Map();
    this.subCount = 0;
    this.subgraphDepth = 0;
    this.direction = 'TB';
    this.accTitleValue = undefined;
    this.accDescriptionValue = undefined;
  }

  // ============================================================
  // 实体管理
  // ============================================================

  /**
   * 添加实体（jison 调用）
   *
   * @param name - 实体名称
   * @param alias - 实体别名（可选，如 `CUSTOMER[Customer]` 中的 `Customer`）
   * @returns 实体节点
   */
  public addEntity(name: string, alias = ''): EntityNode {
    if (!this.entities.has(name)) {
      this.entities.set(name, {
        id: `entity-${name}-${this.entities.size}`,
        label: name,
        attributes: [],
        alias,
        shape: 'erBox',
        cssClasses: 'default',
        cssStyles: [],
        labelType: 'markdown',
      });
    } else {
      const existing = this.entities.get(name);
      if (existing && !existing.alias && alias) {
        existing.alias = alias;
      }
    }

    const result = this.entities.get(name);
    if (!result) {
      // 理论上不会到达此处，addEntity 已经确保 entities.has(name)
      throw new Error(`Failed to add entity: ${name}`);
    }
    return result;
  }

  /** 获取实体 */
  public getEntity(name: string): EntityNode | undefined {
    return this.entities.get(name);
  }

  /** 获取所有实体 */
  public getEntities(): Map<string, EntityNode> {
    return this.entities;
  }

  /** 获取所有样式类 */
  public getClasses(): Map<string, EntityClass> {
    return this.classes;
  }

  /**
   * 添加实体属性（jison 调用）
   *
   * 注意：jison 语法中 attributes 是逆序压栈的，这里 reverse 后逐个添加
   * 同时初始化 keys/comment 字段（jison 语法可能不提供这些字段）
   */
  public addAttributes(entityName: string, attribs: InputAttribute[]): void {
    const entity = this.addEntity(entityName); // May do nothing (if entity has already been added)

    // Process attribs in reverse order due to effect of recursive construction (last attribute is first)
    for (let i = attribs.length - 1; i >= 0; i--) {
      const attr = attribs[i];
      const normalized: Attribute = {
        type: attr.type,
        name: attr.name,
        keys: normalizeAttributeKeys(attr.keys),
        comment: attr.comment ?? '',
      };
      entity.attributes.push(normalized);
    }
  }

  // ============================================================
  // 关系管理
  // ============================================================

  /**
   * 添加关系（jison 调用）
   *
   * @param entA - 第一个实体名称（或 subgraph ID）
   * @param rolA - 第一个实体在关系中的角色
   * @param entB - 第二个实体名称（或 subgraph ID）
   * @param rSpec - 关系细节（cardA/cardB/relType）
   */
  public addRelationship(entA: string, rolA: string, entB: string, rSpec: RelSpec): void {
    // Check if entA is a subgraph, otherwise treat it as an entity
    let entityAId: string;
    if (this.subGraphLookup.has(entA)) {
      entityAId = entA;
    } else {
      const entityA = this.addEntity(entA);
      entityAId = entityA.id;
    }

    // Check if entB is a subgraph, otherwise treat it as an entity
    let entityBId: string;
    if (this.subGraphLookup.has(entB)) {
      entityBId = entB;
    } else {
      const entityB = this.addEntity(entB);
      entityBId = entityB.id;
    }

    const rel: Relationship = {
      entityA: entityAId,
      roleA: rolA,
      entityB: entityBId,
      relSpec: rSpec,
    };

    this.relationships.push(rel);
  }

  /** 获取关系列表 */
  public getRelationships(): Relationship[] {
    return this.relationships;
  }

  // ============================================================
  // 方向管理
  // ============================================================

  /** 获取方向 */
  public getDirection(): string {
    return this.direction;
  }

  /** 设置方向（jison 调用） */
  public setDirection(dir: string): void {
    this.direction = dir;
  }

  // ============================================================
  // 样式管理
  // ============================================================

  /** 编译样式（从 classDefs 收集 styles/textStyles） */
  private getCompiledStyles(classDefs: string[]): string[] {
    let compiledStyles: string[] = [];
    for (const customClass of classDefs) {
      const cssClass = this.classes.get(customClass);
      if (cssClass?.styles) {
        compiledStyles = [...compiledStyles, ...cssClass.styles].map((s) => s.trim());
      }
      if (cssClass?.textStyles) {
        compiledStyles = [...compiledStyles, ...cssClass.textStyles].map((s) => s.trim());
      }
    }
    return compiledStyles;
  }

  /**
   * 添加内联样式（jison 调用，style 语法）
   *
   * @param ids - 实体或 subgraph ID 列表
   * @param styles - 样式列表
   */
  public addCssStyles(ids: string[], styles: string[]): void {
    for (const id of ids) {
      const entity = this.entities.get(id);
      const subGraph = this.subGraphLookup.get(id);

      if (!styles) {
        continue;
      }

      if (entity) {
        if (!entity.cssStyles) {
          entity.cssStyles = [];
        }
        for (const style of styles) {
          entity.cssStyles.push(style);
        }
      }

      if (subGraph) {
        if (!subGraph.cssStyles) {
          subGraph.cssStyles = [];
        }
        for (const style of styles) {
          subGraph.cssStyles.push(style);
        }
      }
    }
  }

  /**
   * 定义样式类（jison 调用，classDef 语法）
   *
   * @param ids - 样式类 ID 列表
   * @param style - 样式列表
   */
  public addClass(ids: string[], style: string[]): void {
    for (const id of ids) {
      const existing = this.classes.get(id);
      const classNode: EntityClass = existing ?? { id, styles: [], textStyles: [] };
      if (!existing) {
        this.classes.set(id, classNode);
      }

      if (style) {
        for (const s of style) {
          if (/color/.exec(s)) {
            const newStyle = s.replace('fill', 'bgFill');
            classNode.textStyles.push(newStyle);
          }
          classNode.styles.push(s);
        }
      }
    }
  }

  /**
   * 应用样式类到实体或 subgraph（jison 调用，class 语法）
   *
   * @param ids - 实体或 subgraph ID 列表
   * @param classNames - 样式类名列表
   */
  public setClass(ids: string[], classNames: string[]): void {
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) {
        if (!entity.cssClasses) {
          entity.cssClasses = '';
        }
        for (const className of classNames) {
          entity.cssClasses += ' ' + className;
        }
      }

      const subGraph = this.subGraphLookup.get(id);
      if (subGraph) {
        for (const className of classNames) {
          subGraph.classes.push(className);
        }
      }
    }
  }

  // ============================================================
  // SubGraph 管理
  // ============================================================

  /**
   * 添加子图（jison 调用）
   *
   * @param _id - 子图 ID 信息 `{ text: string }`
   * @param list - 子图包含的节点列表（可能是字符串或方向对象）
   * @param _title - 子图标题信息 `{ text: string; type?: string }`
   * @returns 子图 ID
   */
  public addSubGraph(
    _id: { text: string },
    list: SubGraphListItem[],
    _title: SubGraphTitle,
  ): string {
    const id = _id.text.trim() || `subGraph${this.subCount}`;
    let title = _title.text || '';

    const uniq = (a: SubGraphListItem[]): { nodeList: string[]; dir: string | undefined } => {
      const seen = new Set<string>();
      let dir: string | undefined;

      const nodeList = a.filter((item): item is string => {
        if (item && typeof item === 'object' && 'stmt' in item) {
          if (item.stmt === 'dir') {
            dir = item.value;
          }
          return false;
        }

        if (typeof item !== 'string') {
          return false;
        }

        const trimmed = item.trim();
        if (!trimmed) {
          return false;
        }

        if (seen.has(trimmed)) {
          return false;
        }
        seen.add(trimmed);

        return true;
      });

      return { nodeList, dir };
    };

    const result = uniq(list.flat() as SubGraphListItem[]);
    const nodeList = result.nodeList;
    // If no explicit direction is declared within the subgraph, leave dir as undefined
    // so that the layout engine applies its own default direction
    const dir = result.dir;

    title = this.sanitizeText(title);
    this.subCount = this.subCount + 1;

    const subGraph: ErSubGraph = {
      id,
      nodes: nodeList,
      title: title.trim(),
      classes: [],
      cssStyles: [],
      dir,
      labelType: this.sanitizeNodeLabelType(_title?.type),
    };

    // Ensure nodes are unique across subgraphs by removing duplicates from the new subgraph
    subGraph.nodes = this.makeUniq(subGraph, this.subGraphs).nodes;
    this.subGraphs.push(subGraph);
    this.subGraphLookup.set(id, subGraph);
    return id;
  }

  /** 获取所有子图 */
  public getSubGraphs(): ErSubGraph[] {
    return this.subGraphs;
  }

  /**
   * 构建所有已分配给现有 subgraph 的节点 ID 的快速查找表
   */
  private subgraphNodeCache(allSubgraphs: ErSubGraph[]): Set<string> {
    const nodeCache = new Set<string>();
    for (const subGraph of allSubgraphs) {
      for (const id of subGraph.nodes) {
        nodeCache.add(id);
      }
    }
    return nodeCache;
  }

  /**
   * 过滤掉已经属于另一个 subgraph 的节点，保持 subgraph 成员唯一
   */
  private makeUniq(subGraph: ErSubGraph, allSubgraphs: ErSubGraph[]): { nodes: string[] } {
    const existingNodes = this.subgraphNodeCache(allSubgraphs);
    const res: string[] = [];
    subGraph.nodes.forEach((nodeId) => {
      if (existingNodes.has(nodeId)) {
        // 节点已属于另一个 subgraph，忽略（保持官方逻辑，但不输出日志）
      } else {
        res.push(nodeId);
      }
    });
    return { nodes: res };
  }

  // ============================================================
  // 文本处理（简化版，不做 HTML 转义，由渲染层负责）
  // ============================================================

  /** 清理文本（移除首尾空白，不做 HTML 转义） */
  private sanitizeText(txt: string): string {
    return txt;
  }

  /** 规范化节点标签类型 */
  private sanitizeNodeLabelType(labelType?: string): string {
    switch (labelType) {
      case 'markdown':
      case 'string':
      case 'text':
        return labelType;
      default:
        return 'markdown';
    }
  }

  // ============================================================
  // Accessibility
  // ============================================================

  /** 设置 Accessibility 标题（jison 调用） */
  public setAccTitle(title: string): void {
    this.accTitleValue = title;
  }

  /** 获取 Accessibility 标题 */
  public getAccTitle(): string | undefined {
    return this.accTitleValue;
  }

  /** 设置 Accessibility 描述（jison 调用） */
  public setAccDescription(desc: string): void {
    this.accDescriptionValue = desc;
  }

  /** 获取 Accessibility 描述 */
  public getAccDescription(): string | undefined {
    return this.accDescriptionValue;
  }

  // ============================================================
  // getData — 返回 ERAST
  // ============================================================

  public getData(): ERAST {
    return {
      entities: this.entities,
      relationships: this.relationships,
      classes: this.classes,
      subGraphs: this.subGraphs,
      direction: this.direction,
      accTitle: this.accTitleValue,
      accDescr: this.accDescriptionValue,
    };
  }
}

// ============================================================
// 辅助函数
// ============================================================

/** 规范化属性键列表（过滤无效值，转换为 ErAttributeKeyType） */
function normalizeAttributeKeys(keys?: string[]): Attribute['keys'] {
  if (!keys) {
    return [];
  }
  const validKeys: Attribute['keys'] = [];
  for (const key of keys) {
    if (key === 'PK' || key === 'FK' || key === 'UK') {
      validKeys.push(key);
    }
  }
  return validKeys;
}
