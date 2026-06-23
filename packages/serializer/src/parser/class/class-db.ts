/**
 * ClassDB — 官方 mermaid `classDb.ts` 的纯 TypeScript 移植
 *
 * 单一职责：jison parser 调用此类的实例方法收集 AST 数据
 *
 * 与官方的差异:
 *   - 移除 D3/select/DOMPurify 依赖（getData 返回纯数据，不操作 DOM）
 *   - 移除 getConfig 依赖（使用默认配置，不做 securityLevel 相关处理）
 *   - 移除 common.sanitizeText（HTML 转义由渲染层负责）
 *   - 移除 commonClear/setAccTitle 等 commonDb 依赖（在本地实现）
 *   - 移除 createTooltip/setupToolTips/bindFunctions（DOM 操作由渲染层负责）
 *   - 移除 setClickFunc 中的 document.querySelector（事件绑定由渲染层负责）
 *   - 移除 lookUpDomId/setDiagramId（DOM ID 由渲染层负责）
 *   - 移除 getArrowMarker（渲染逻辑由渲染层负责）
 *   - 移除 getData() 中的 nodes/edges 构建（由 class-parser.ts 的 mapAstToCanvasState 负责）
 *   - 适配 TypeScript 严格模式（禁止 any，禁止 ! 非空断言）
 *   - 保留 addClass/addRelation/addMembers/addMember/addAnnotation/addNote/addNamespace/
 *     addClassesToNamespace/popNamespace/setCssClass/setCssStyle/setLink/setClickEvent/
 *     setTooltip/setDirection/defineClass/setClassLabel/cleanupLabel 逻辑
 *   - 保留 namespace 嵌套栈管理
 *   - getData() 返回 ClassAST（原始数据结构，非渲染输出）
 *
 * 数据流:
 *   jison parser → ClassDB.addClass/addRelation/... → ClassDB.getData() → ClassAST
 *
 * 注意:
 *   - jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
 *   - relationType/lineType 作为实例属性挂载，供 jison 语法动作引用
 */

import { ClassMember } from './class-member.js';
import { RELATION_TYPE, LINE_TYPE } from './constants.js';
import type {
  ClassNode,
  ClassRelation,
  ClassNote,
  NamespaceNode,
  Interface,
  StyleClass,
  ClassMap,
  ClassNoteMap,
  NamespaceMap,
} from './types.js';
import type { ClassAST } from '../../ast/class-ast.js';

// ============================================================
// 常量
// ============================================================

const MERMAID_DOM_ID_PREFIX = 'classId-';

// ============================================================
// ClassDB 类
// ============================================================

/**
 * ClassDB — class 解析数据收集器
 *
 * 实例方法被 jison parser 通过 `yy.methodName()` 调用
 * 所有 jison 调用的方法在构造函数中 bind，确保 this 指向正确
 */
export class ClassDB {
  private relations: ClassRelation[] = [];
  private classes: ClassMap = new Map<string, ClassNode>();
  private readonly styleClasses = new Map<string, StyleClass>();
  private notes: ClassNoteMap = new Map<string, ClassNote>();
  private interfaces: Interface[] = [];
  private namespaces = new Map<string, NamespaceNode>();
  private namespaceCounter = 0;
  private namespaceStack: string[] = [];

  private classCounter = 0;
  private directionValue: string | undefined;
  private accTitleValue: string | undefined;
  private accDescriptionValue: string | undefined;

  // 常量作为实例属性挂载（jison 通过 yy.relationType / yy.lineType 访问）
  public readonly relationType = RELATION_TYPE;
  public readonly lineType = LINE_TYPE;

  constructor() {
    // jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
    this.addRelation = this.addRelation.bind(this);
    this.addClassesToNamespace = this.addClassesToNamespace.bind(this);
    this.addNamespace = this.addNamespace.bind(this);
    this.popNamespace = this.popNamespace.bind(this);
    this.setCssClass = this.setCssClass.bind(this);
    this.addMembers = this.addMembers.bind(this);
    this.addClass = this.addClass.bind(this);
    this.setClassLabel = this.setClassLabel.bind(this);
    this.addAnnotation = this.addAnnotation.bind(this);
    this.addMember = this.addMember.bind(this);
    this.cleanupLabel = this.cleanupLabel.bind(this);
    this.addNote = this.addNote.bind(this);
    this.defineClass = this.defineClass.bind(this);
    this.setDirection = this.setDirection.bind(this);
    this.setLink = this.setLink.bind(this);
    this.setTooltip = this.setTooltip.bind(this);
    this.setClickEvent = this.setClickEvent.bind(this);
    this.setCssStyle = this.setCssStyle.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
    this.clear = this.clear.bind(this);

    this.clear();
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /** 重置状态 */
  public clear(): void {
    this.relations = [];
    this.classes = new Map<string, ClassNode>();
    this.notes = new Map<string, ClassNote>();
    this.interfaces = [];
    this.namespaces = new Map<string, NamespaceNode>();
    this.namespaceCounter = 0;
    this.namespaceStack = [];
    this.classCounter = 0;
    this.directionValue = undefined;
    this.accTitleValue = undefined;
    this.accDescriptionValue = undefined;
  }

  // ============================================================
  // 文本处理（简化版，不做 HTML 转义，由渲染层负责）
  // ============================================================

  /** 清理标签文本（移除前导冒号） */
  public cleanupLabel(label: string): string {
    let cleaned = label;
    if (cleaned.startsWith(':')) {
      cleaned = cleaned.substring(1);
    }
    return cleaned.trim();
  }

  // ============================================================
  // 类名解析
  // ============================================================

  /** 拆分类名和泛型类型
   *
   * 输入 `List~Item~` → `{ className: 'List', type: 'Item' }`
   */
  private splitClassNameAndType(id: string): { className: string; type: string } {
    let genericType = '';
    let className = id;

    if (id.indexOf('~') > 0) {
      const split = id.split('~');
      className = split[0];
      genericType = split[1];
    }

    return { className, type: genericType };
  }

  // ============================================================
  // 类管理
  // ============================================================

  /**
   * 添加类（jison 调用）
   *
   * @param id - 类 ID（可能含泛型，如 `List~Item~`）
   */
  public addClass(id: string): void {
    const { className, type } = this.splitClassNameAndType(id);
    // Only add class if not exists
    if (this.classes.has(className)) {
      return;
    }

    this.classes.set(className, {
      id: className,
      type,
      label: className,
      text: `${className}${type ? `&lt;${type}&gt;` : ''}`,
      shape: 'classBox',
      cssClasses: 'default',
      methods: [],
      members: [],
      annotations: [],
      styles: [],
      domId: MERMAID_DOM_ID_PREFIX + className + '-' + this.classCounter,
    });

    this.classCounter++;
  }

  /** 设置类标签（jison 调用） */
  public setClassLabel(id: string, label: string): void {
    const { className } = this.splitClassNameAndType(id);
    const classNode = this.classes.get(className);
    if (!classNode) {
      return;
    }
    classNode.label = label;
    classNode.text = `${label}${classNode.type ? `<${classNode.type}>` : ''}`;
  }

  /** 添加注解（jison 调用） */
  public addAnnotation(className: string, annotation: string): void {
    const { className: validatedClassName } = this.splitClassNameAndType(className);
    const classNode = this.classes.get(validatedClassName);
    if (!classNode) {
      return;
    }
    classNode.annotations.push(annotation);
  }

  /**
   * 添加成员（jison 调用）
   *
   * @param className - 类名
   * @param member - 成员字符串。如果以 `<<` 开头 `>>` 结尾则视为注解；
   *                 如果包含 `)` 则视为方法；否则视为属性
   */
  public addMember(className: string, member: string): void {
    this.addClass(className);

    const { className: validatedClassName } = this.splitClassNameAndType(className);
    const theClass = this.classes.get(validatedClassName);
    if (!theClass) {
      return;
    }

    if (typeof member === 'string') {
      const memberString = member.trim();

      if (memberString.startsWith('<<') && memberString.endsWith('>>')) {
        // its an annotation
        theClass.annotations.push(memberString.substring(2, memberString.length - 2));
      } else if (memberString.indexOf(')') > 0) {
        // its a method
        theClass.methods.push(new ClassMember(memberString, 'method'));
      } else if (memberString) {
        theClass.members.push(new ClassMember(memberString, 'attribute'));
      }
    }
  }

  /** 批量添加成员（jison 调用）
   *
   * 注意：jison 语法中 members 是逆序压栈的，这里 reverse 后逐个添加
   */
  public addMembers(className: string, members: string[]): void {
    if (Array.isArray(members)) {
      members.reverse();
      members.forEach((member) => this.addMember(className, member));
    }
  }

  // ============================================================
  // 关系管理
  // ============================================================

  /** 添加关系（jison 调用） */
  public addRelation(classRelation: ClassRelation): void {
    // Due to relationType cannot just check if it is equal to 'none' or it complains, can fix this later
    // invalidTypes 为 RELATION_TYPE 数值列表，用于判断另一端是否为有效关系类型
    const invalidTypes: number[] = [
      this.relationType.LOLLIPOP,
      this.relationType.AGGREGATION,
      this.relationType.COMPOSITION,
      this.relationType.DEPENDENCY,
      this.relationType.EXTENSION,
    ];

    const type1 = typeof classRelation.relation.type1 === 'number'
      ? classRelation.relation.type1
      : undefined;
    const type2 = typeof classRelation.relation.type2 === 'number'
      ? classRelation.relation.type2
      : undefined;

    if (
      type1 === this.relationType.LOLLIPOP &&
      type2 !== undefined &&
      !invalidTypes.includes(type2)
    ) {
      this.addClass(classRelation.id1);
      this.addInterface(classRelation.id1, classRelation.id2);
      classRelation.id1 = `interface${this.interfaces.length - 1}`;
    } else if (
      type2 === this.relationType.LOLLIPOP &&
      type1 !== undefined &&
      !invalidTypes.includes(type1)
    ) {
      this.addClass(classRelation.id1);
      this.addInterface(classRelation.id2, classRelation.id1);
      classRelation.id2 = `interface${this.interfaces.length - 1}`;
    } else {
      this.addClass(classRelation.id1);
      this.addClass(classRelation.id2);
    }

    classRelation.id1 = this.splitClassNameAndType(classRelation.id1).className;
    classRelation.id2 = this.splitClassNameAndType(classRelation.id2).className;

    classRelation.relationTitle1 = classRelation.relationTitle1.trim();
    classRelation.relationTitle2 = classRelation.relationTitle2.trim();

    this.relations.push(classRelation);
  }

  /** 添加接口（lollipop 关系自动生成） */
  private addInterface(label: string, classId: string): void {
    const classInterface: Interface = {
      id: `interface${this.interfaces.length}`,
      label,
      classId,
    };
    this.interfaces.push(classInterface);
  }

  // ============================================================
  // Note（注释）管理
  // ============================================================

  /** 添加 Note（jison 调用）
   *
   * @param text - Note 文本
   * @param className - 关联的类 ID（可选，note for Class 语法提供）
   * @returns Note ID（note0, note1, ...）
   */
  public addNote(text: string, className?: string): string {
    const index = this.notes.size;
    const note: ClassNote = {
      id: `note${index}`,
      class: className ?? '',
      text,
      index,
    };
    this.notes.set(note.id, note);
    return note.id;
  }

  // ============================================================
  // Namespace（命名空间）管理
  // ============================================================

  /** 解析限定 ID（拼接当前命名空间栈顶前缀） */
  private static resolveQualifiedId(id: string, stack: string[]): string {
    const prefix = stack.at(-1);
    return prefix ? `${prefix}.${id}` : id;
  }

  /** 获取所有祖先 ID（含自身） */
  private static getAncestorIds(qualifiedId: string): string[] {
    const parts = qualifiedId.split('.');
    const ids: string[] = new Array(parts.length);
    ids[0] = parts[0];
    for (let i = 1; i < parts.length; i++) {
      ids[i] = `${ids[i - 1]}.${parts[i]}`;
    }
    return ids;
  }

  /** 创建命名空间节点 */
  private createNamespaceNode(
    id: string,
    label: string,
    parentId?: string,
    explicit = false,
  ): NamespaceNode {
    return {
      id,
      label,
      classes: new Map<string, ClassNode>(),
      notes: new Map<string, ClassNote>(),
      children: new Map<string, NamespaceNode>(),
      domId: MERMAID_DOM_ID_PREFIX + id + '-' + this.namespaceCounter++,
      parent: parentId,
      explicit,
    };
  }

  /** 链接父子命名空间 */
  private linkParentChild(parentId: string, childId: string): void {
    const parent = this.namespaces.get(parentId);
    const child = this.namespaces.get(childId);
    if (!parent || !child) {
      return;
    }
    if (!parent.children.has(childId)) {
      parent.children.set(childId, child);
    }
    if (child.parent === undefined) {
      child.parent = parentId;
    }
  }

  /** 添加命名空间（jison 调用）
   *
   * 支持点分名称（`A.B`），自动创建中间祖先
   *
   * @param id - 命名空间 ID（可能是点分名称）
   * @param label - 命名空间标签（可选）
   * @returns 限定 ID（含父前缀）
   */
  public addNamespace(id: string, label?: string): string {
    const qualifiedId = ClassDB.resolveQualifiedId(id, this.namespaceStack);
    // Push first — grammar guarantees a matching popNamespace in all cases, including re-declarations
    this.namespaceStack.push(qualifiedId);

    const existing = this.namespaces.get(qualifiedId);
    if (existing) {
      // Re-declaration promotes an auto-created ancestor to explicit
      existing.explicit = true;
      if (label) {
        existing.label = label;
      }
      return qualifiedId;
    }

    const parts = qualifiedId.split('.');
    const ancestorIds = ClassDB.getAncestorIds(qualifiedId);
    for (let i = 0; i < ancestorIds.length; i++) {
      const currentId = ancestorIds[i];
      const parentId = i > 0 ? ancestorIds[i - 1] : undefined;
      const isLeaf = i === ancestorIds.length - 1;
      const nodeLabel = isLeaf && label ? label : parts[i];

      const current = this.namespaces.get(currentId);
      if (!current) {
        this.namespaces.set(
          currentId,
          this.createNamespaceNode(currentId, nodeLabel, parentId, isLeaf),
        );
      } else if (isLeaf) {
        current.explicit = true;
      }
      if (parentId) {
        this.linkParentChild(parentId, currentId);
      }
    }

    return qualifiedId;
  }

  /** 弹出命名空间栈（jison 调用） */
  public popNamespace(): void {
    this.namespaceStack.pop();
  }

  /** 将类和注释添加到命名空间（jison 调用） */
  public addClassesToNamespace(id: string, classNames: string[], noteNames: string[]): void {
    const namespace = this.namespaces.get(id);
    if (!namespace) {
      return;
    }
    for (const name of classNames) {
      const { className } = this.splitClassNameAndType(name);
      const classNode = this.classes.get(className);
      if (!classNode) {
        continue;
      }
      classNode.parent = id;
      namespace.classes.set(className, classNode);
    }
    for (const noteName of noteNames) {
      const noteNode = this.notes.get(noteName);
      if (!noteNode) {
        continue;
      }
      noteNode.parent = id;
      namespace.notes.set(noteName, noteNode);
    }
  }

  // ============================================================
  // 样式管理
  // ============================================================

  /** 定义样式类（jison 调用，classDef 语法） */
  public defineClass(ids: string[], style: string[]): void {
    for (const id of ids) {
      let styleClass = this.styleClasses.get(id);
      if (styleClass === undefined) {
        styleClass = { id, styles: [], textStyles: [] };
        this.styleClasses.set(id, styleClass);
      }

      if (style) {
        style.forEach((s) => {
          if (/color/.exec(s)) {
            const newStyle = s.replace('fill', 'bgFill');
            styleClass.textStyles.push(newStyle);
          }
          styleClass.styles.push(s);
        });
      }

      this.classes.forEach((value) => {
        if (value.cssClasses.includes(id)) {
          value.styles.push(...style.flatMap((s) => s.split(',')));
        }
      });
    }
  }

  /** 设置 CSS 类（jison 调用，cssClass 语法） */
  public setCssClass(ids: string, className: string): void {
    ids.split(',').forEach((_id) => {
      let id = _id;
      if (/\d/.exec(_id[0])) {
        id = MERMAID_DOM_ID_PREFIX + id;
      }
      id = this.splitClassNameAndType(id).className;
      const classNode = this.classes.get(id);
      if (classNode) {
        classNode.cssClasses += ' ' + className;
      }
    });
  }

  /** 设置内联样式（jison 调用，style 语法） */
  public setCssStyle(id: string, styles: string[]): void {
    const thisClass = this.classes.get(id);
    if (!styles || !thisClass) {
      return;
    }
    for (const s of styles) {
      if (s.includes(',')) {
        thisClass.styles.push(...s.split(','));
      } else {
        thisClass.styles.push(s);
      }
    }
  }

  // ============================================================
  // 交互管理（click/link/tooltip）
  // ============================================================

  /** 设置链接（jison 调用，link/click href 语法） */
  public setLink(ids: string, linkStr: string, target?: string): void {
    ids.split(',').forEach((_id) => {
      let id = _id;
      if (/\d/.exec(_id[0])) {
        id = MERMAID_DOM_ID_PREFIX + id;
      }
      id = this.splitClassNameAndType(id).className;
      const theClass = this.classes.get(id);
      if (theClass) {
        theClass.link = linkStr;
        if (typeof target === 'string') {
          theClass.linkTarget = target;
        } else {
          theClass.linkTarget = '_blank';
        }
      }
    });
    this.setCssClass(ids, 'clickable');
  }

  /** 设置 tooltip（jison 调用） */
  public setTooltip(ids: string, tooltip?: string): void {
    ids.split(',').forEach((id) => {
      if (tooltip !== undefined) {
        const { className } = this.splitClassNameAndType(id);
        const classNode = this.classes.get(className);
        if (classNode) {
          classNode.tooltip = tooltip;
        }
      }
    });
  }

  /** 设置点击事件（jison 调用，click/callback 语法）
   *
   * 注意：解析层不绑定 DOM 事件，仅记录 haveCallback 标记
   * 事件绑定由渲染层负责
   */
  public setClickEvent(ids: string, functionName: string, functionArgs?: string): void {
    ids.split(',').forEach((id) => {
      const { className } = this.splitClassNameAndType(id);
      const classNode = this.classes.get(className);
      if (classNode) {
        classNode.haveCallback = true;
        // 记录回调信息到扩展字段（供渲染层使用）
        (classNode as ClassNode & { clickCallback?: string; clickFunction?: string; clickArgs?: string }).clickCallback = functionName;
        (classNode as ClassNode & { clickCallback?: string; clickFunction?: string; clickArgs?: string }).clickFunction = functionName;
        if (functionArgs !== undefined) {
          (classNode as ClassNode & { clickArgs?: string }).clickArgs = functionArgs;
        }
      }
    });
    this.setCssClass(ids, 'clickable');
  }

  // ============================================================
  // 方向 / Accessibility
  // ============================================================

  /** 设置方向（jison 调用） */
  public setDirection(dir: string): void {
    this.directionValue = dir;
  }

  /** 获取方向（未显式设置时返回 undefined） */
  public getDirection(): string | undefined {
    return this.directionValue;
  }

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
  // Getters
  // ============================================================

  public getClass(id: string): ClassNode | undefined {
    return this.classes.get(id);
  }

  public getClasses(): ClassMap {
    return this.classes;
  }

  public getRelations(): ClassRelation[] {
    return this.relations;
  }

  public getNote(id: string): ClassNote | undefined {
    return this.notes.get(id);
  }

  public getNotes(): ClassNoteMap {
    return this.notes;
  }

  public getNamespaces(): NamespaceMap {
    return this.namespaces;
  }

  public getInterfaces(): Interface[] {
    return this.interfaces;
  }

  public getStyleClasses(): Map<string, StyleClass> {
    return this.styleClasses;
  }

  // ============================================================
  // getData — 返回 ClassAST
  // ============================================================

  public getData(): ClassAST {
    return {
      classes: this.classes,
      relations: this.relations,
      notes: this.notes,
      interfaces: this.interfaces,
      namespaces: this.namespaces,
      styleClasses: this.styleClasses,
      direction: this.directionValue,
      accTitle: this.accTitleValue,
      accDescr: this.accDescriptionValue,
    };
  }
}
