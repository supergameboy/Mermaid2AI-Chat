/**
 * StateDB — 官方 mermaid `stateDb.ts` + `dataFetcher.ts` 的纯 TypeScript 移植
 *
 * 单一职责：jison parser 调用此类的实例方法收集 AST 数据，并通过 getData() 返回 StateDBData
 *
 * 与官方的差异:
 *   - 移除 d3/DOMPurify/createTooltip/setupToolTips/bindFunctions 等 DOM 相关代码
 *   - 移除 getConfig() 调用（使用默认值 'classic' 替代 look 字段）
 *   - 移除 common.sanitizeText（简化为 trim，HTML 转义由渲染层负责）
 *   - 移除 commonClear/getDiagramTitle 等 commonDb 依赖（在本地实现）
 *   - 移除 log 依赖（解析层不输出日志）
 *   - 移除 getDir 依赖（在本地实现）
 *   - dataFetcher 逻辑集成到 StateDB 内部（作为 private 方法）
 *   - 适配 TypeScript 严格模式（禁止 any，禁止 ! 非空断言）
 *   - 保留 extract/addState/addRelation/addStyleClass/setCssClass/setStyle/setTextStyle/
 *     setDirection/getDirection/addLink/getLinks/addDescription/getDividerId/
 *     startIdIfNeeded/endIdIfNeeded/docTranslator/getRootDocV2 逻辑
 *   - getData() 返回 StateDBData（{ nodes, edges, other, direction }）
 *
 * 数据流:
 *   jison parser → StateDB.setRootDoc → StateDB.extract → StateDB.addState/addRelation/...
 *     → StateDB.dataFetcher（内部）→ StateDB.nodes/edges
 *   → StateDB.getData() → StateDBData
 *
 * 注意:
 *   - jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
 *   - jison 通过 yy.methodName() 调用 StateDB 实例方法
 */

import type {
  StateNodeType,
  StateNotePosition,
  FlowchartDirection,
} from '../../types.js';
import type {
  StateStmt,
  StateASTNote,
  StateDBNode,
  StateDBEdge,
  StateDBData,
  StateStyleClass,
  StateLinkInfo,
  StateStmtRef,
} from './state-types.js';
import {
  DEFAULT_DIAGRAM_DIRECTION,
  DEFAULT_NESTED_DOC_DIR,
  STMT_DIRECTION,
  STMT_STATE,
  STMT_ROOT,
  STMT_RELATION,
  STMT_CLASSDEF,
  STMT_STYLEDEF,
  STMT_APPLYCLASS,
  DEFAULT_STATE_TYPE,
  DIVIDER_TYPE,
  SHAPE_STATE,
  SHAPE_STATE_WITH_DESC,
  SHAPE_START,
  SHAPE_END,
  SHAPE_DIVIDER,
  SHAPE_GROUP,
  SHAPE_NOTE,
  SHAPE_NOTEGROUP,
  START_NODE,
  START_TYPE,
  END_NODE,
  END_TYPE,
  STYLECLASS_SEP,
  COLOR_KEYWORD,
  FILL_KEYWORD,
  BG_FILL,
  DOMID_STATE,
  DOMID_TYPE_SPACER,
  NOTE,
  PARENT,
  NOTE_ID,
  PARENT_ID,
  G_EDGE_STYLE,
  G_EDGE_ARROWHEADSTYLE,
  G_EDGE_LABELPOS,
  G_EDGE_LABELTYPE,
  G_EDGE_THICKNESS,
} from './state-constants.js';

// ============================================================
// 内部类型
// ============================================================

interface StateDocument {
  relations: Array<{ id1: string; id2: string; relationTitle?: string }>;
  states: Map<string, StateStmt>;
  documents: Record<string, StateDocument>;
}

interface InternalNote {
  position?: StateNotePosition;
  text: string;
}

interface StyleStmt {
  stmt: 'style';
  id: string;
  styleClass: string;
}

interface ClickStmt {
  stmt: 'click';
  id: string | StateStmt;
  url: string;
  tooltip: string;
}

interface DirectionStmt {
  stmt: 'dir';
  value: FlowchartDirection;
}

interface RootStmt {
  id: 'root';
  stmt: 'root';
  doc?: StateStmt[];
}

const DEFAULT_LOOK = 'classic' as const;

const CSS_DIAGRAM = 'statediagram';
const CSS_STATE = 'state';
const CSS_DIAGRAM_STATE = `${CSS_DIAGRAM}-${CSS_STATE}`;
const CSS_EDGE = 'transition';
const CSS_NOTE = 'note';
const CSS_NOTE_EDGE = 'note-edge';
const CSS_EDGE_NOTE_EDGE = `${CSS_EDGE} ${CSS_NOTE_EDGE}`;
const CSS_DIAGRAM_NOTE = `${CSS_DIAGRAM}-${CSS_NOTE}`;
const CSS_CLUSTER = 'cluster';
const CSS_DIAGRAM_CLUSTER = `${CSS_DIAGRAM}-${CSS_CLUSTER}`;
const CSS_CLUSTER_ALT = 'cluster-alt';
const CSS_DIAGRAM_CLUSTER_ALT = `${CSS_DIAGRAM}-${CSS_CLUSTER_ALT}`;

function newClassesList(): Map<string, StateStyleClass> {
  return new Map();
}

function newDoc(): StateDocument {
  return {
    relations: [],
    states: new Map(),
    documents: {},
  };
}

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `id-${Math.random().toString(36).slice(2, 14)}-${idCounter}`;
}

function stateDomId(
  itemId = '',
  counter = 0,
  type: string | null = '',
  typeSpacer = DOMID_TYPE_SPACER,
): string {
  const typeStr = type !== null && type.length > 0 ? `${typeSpacer}${type}` : '';
  return `${DOMID_STATE}-${itemId}${typeStr}-${counter}`;
}

function getDirFromStmt(
  parsedItem: { doc?: StateStmt[] },
  defaultDir: string = DEFAULT_NESTED_DOC_DIR,
): string {
  if (!parsedItem.doc) {
    return defaultDir;
  }
  let dir = defaultDir;
  for (const parsedItemDoc of parsedItem.doc) {
    if (parsedItemDoc.stmt === 'dir') {
      dir = (parsedItemDoc as DirectionStmt).value;
    }
  }
  return dir;
}

function getClassesFromDbInfo(dbInfoItem?: StateStmt): string {
  if (!dbInfoItem || dbInfoItem.stmt !== 'state') {
    return '';
  }
  return dbInfoItem.classes?.join(' ') ?? '';
}

function getStylesFromDbInfo(dbInfoItem?: StateStmt): string[] {
  if (!dbInfoItem || dbInfoItem.stmt !== 'state') {
    return [];
  }
  return dbInfoItem.styles ?? [];
}

function sanitizeText(text: string): string {
  return text.trim();
}

export class StateDB {
  private nodes: StateDBNode[] = [];
  private edges: StateDBEdge[] = [];
  private rootDoc: StateStmt[] = [];
  private classes = newClassesList();
  private documents: { root: StateDocument } = { root: newDoc() };
  private currentDocument: StateDocument = this.documents.root;
  private startEndCount = 0;
  private dividerCnt = 0;
  private links = new Map<string, StateLinkInfo>();
  private nodeDb = new Map<string, StateDBNode>();
  private graphItemCount = 0;
  private accTitleValue: string | undefined;
  private accDescriptionValue: string | undefined;

  constructor(private version: 1 | 2) {
    this.clear();
    this.setRootDoc = this.setRootDoc.bind(this);
    this.getDividerId = this.getDividerId.bind(this);
    this.setDirection = this.setDirection.bind(this);
    this.trimColon = this.trimColon.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
  }

  public setRootDoc(o: StateStmt[]): void {
    this.rootDoc = o;
    if (this.version === 1) {
      this.extract(o);
    } else {
      this.extract(this.getRootDocV2());
    }
  }

  public extract(statements: StateStmt[] | { id?: string; doc?: StateStmt[] }): void {
    this.clear(true);
    const stmts = Array.isArray(statements)
      ? statements
      : (statements.doc ?? []);
    for (const item of stmts) {
      switch (item.stmt) {
        case STMT_STATE: {
          const stateItem = item as Extract<StateStmt, { stmt: 'state' }>;
          this.addState(
            stateItem.id.trim(),
            stateItem.type,
            stateItem.doc,
            stateItem.description,
            stateItem.note,
          );
          break;
        }
        case STMT_RELATION: {
          const relItem = item as Extract<StateStmt, { stmt: 'relation' }>;
          this.addRelation(relItem.state1, relItem.state2, relItem.description);
          break;
        }
        case STMT_CLASSDEF: {
          const classDefItem = item as Extract<StateStmt, { stmt: 'classDef' }>;
          this.addStyleClass(classDefItem.id.trim(), classDefItem.classes);
          break;
        }
        case STMT_STYLEDEF: {
          this.handleStyleDef(item as StyleStmt);
          break;
        }
        case STMT_APPLYCLASS: {
          const applyItem = item as Extract<StateStmt, { stmt: 'applyClass' }>;
          this.setCssClass(applyItem.id.trim(), applyItem.styleClass);
          break;
        }
        case 'click': {
          const clickItem = item as ClickStmt;
          const clickId =
            typeof clickItem.id === 'string'
              ? clickItem.id
              : (clickItem.id as { id?: string }).id ?? '';
          this.addLink(clickId, clickItem.url, clickItem.tooltip);
          break;
        }
      }
    }

    const diagramStates = this.getStates();

    this.dataFetcher(
      undefined,
      this.getRootDocV2() as StateStmt & { id: string; doc: StateStmt[] },
      diagramStates,
      true,
    );

    for (const node of this.nodes) {
      if (!Array.isArray(node.label)) {
        continue;
      }
      const labels = node.label as string[];
      node.description = labels.slice(1);
      if (node.isGroup && (node.description as string[]).length > 0) {
        throw new Error(
          `Group nodes can only have label. Remove the additional description for node [${node.id}]`,
        );
      }
      node.label = labels[0];
    }
  }

  private handleStyleDef(item: StyleStmt): void {
    const ids = item.id.trim().split(',');
    const styles = item.styleClass.split(',');

    for (const id of ids) {
      let state = this.getState(id);
      if (!state) {
        const trimmedId = id.trim();
        this.addState(trimmedId);
        state = this.getState(trimmedId);
      }
      if (state && state.stmt === 'state') {
        const stateMember = state as Extract<StateStmt, { stmt: 'state' }>;
        stateMember.styles = styles.map((s) => s.replace(/;/g, '').trim());
      }
    }
  }

  public docTranslator(
    parent: RootStmt | StateStmt,
    node: StateStmt,
    first: boolean,
  ): void {
    if (node.stmt === STMT_RELATION) {
      const relNode = node as Extract<StateStmt, { stmt: 'relation' }>;
      if (typeof relNode.state1 === 'object') {
        this.docTranslator(parent, relNode.state1, true);
      }
      if (typeof relNode.state2 === 'object') {
        this.docTranslator(parent, relNode.state2, false);
      }
      return;
    }

    if (node.stmt === STMT_STATE) {
      const stateNode = node as Extract<StateStmt, { stmt: 'state' }>;
      if (stateNode.id === START_NODE) {
        stateNode.id = (parent as { id: string }).id + (first ? '_start' : '_end');
        stateNode.start = first;
      } else {
        stateNode.id = stateNode.id.trim();
      }
    }

    const nodeWithDoc = node as { stmt: string; doc?: StateStmt[] };
    if (
      (node.stmt !== STMT_ROOT && node.stmt !== STMT_STATE) ||
      !nodeWithDoc.doc
    ) {
      return;
    }

    const doc: StateStmt[] = [];
    let currentDoc: StateStmt[] = [];
    for (const stmt of nodeWithDoc.doc) {
      if (
        stmt.stmt === STMT_STATE &&
        (stmt as { type?: string }).type === DIVIDER_TYPE
      ) {
        const newNode = clone(stmt) as StateStmt;
        (newNode as { doc?: StateStmt[] }).doc = clone(currentDoc);
        doc.push(newNode);
        currentDoc = [];
      } else {
        currentDoc.push(stmt);
      }
    }

    if (doc.length > 0 && currentDoc.length > 0) {
      const newNode = {
        stmt: STMT_STATE,
        id: generateId(),
        type: DIVIDER_TYPE,
        doc: clone(currentDoc),
      } as StateStmt;
      doc.push(clone(newNode));
      nodeWithDoc.doc = doc;
    }

    if (nodeWithDoc.doc) {
      for (const docNode of nodeWithDoc.doc) {
        this.docTranslator(node, docNode, true);
      }
    }
  }

  private getRootDocV2(): { id: string; doc: StateStmt[] } {
    const rootStmt: RootStmt = { id: STMT_ROOT, stmt: STMT_ROOT };
    this.docTranslator(
      rootStmt,
      { id: STMT_ROOT, stmt: STMT_ROOT, doc: this.rootDoc } as StateStmt,
      true,
    );
    return { id: STMT_ROOT, doc: this.rootDoc };
  }

  public addState(
    id: string,
    type: StateNodeType = DEFAULT_STATE_TYPE as StateNodeType,
    doc: StateStmt[] | undefined = undefined,
    descr: string | string[] | undefined = undefined,
    note: StateASTNote | undefined = undefined,
    classes: string | string[] | undefined = undefined,
    styles: string | string[] | undefined = undefined,
    textStyles: string | string[] | undefined = undefined,
  ): void {
    const trimmedId = id?.trim();
    if (!this.currentDocument.states.has(trimmedId)) {
      this.currentDocument.states.set(trimmedId, {
        stmt: STMT_STATE,
        id: trimmedId,
        descriptions: [],
        type,
        doc,
        note,
        classes: [],
        styles: [],
        textStyles: [],
      } as StateStmt);
    } else {
      const state = this.currentDocument.states.get(trimmedId);
      if (!state) {
        throw new Error(`State not found: ${trimmedId}`);
      }
      if (state.stmt === 'state') {
        const stateMember = state as Extract<StateStmt, { stmt: 'state' }>;
        if (!stateMember.doc) {
          stateMember.doc = doc;
        }
        if (!stateMember.type) {
          stateMember.type = type;
        }
      }
    }

    if (descr) {
      const descriptions = Array.isArray(descr) ? descr : [descr];
      descriptions.forEach((des) => this.addDescription(trimmedId, des.trim()));
    }

    if (note) {
      const doc2 = this.currentDocument.states.get(trimmedId);
      if (!doc2) {
        throw new Error(`State not found: ${trimmedId}`);
      }
      if (doc2.stmt === 'state') {
        const stateMember = doc2 as Extract<StateStmt, { stmt: 'state' }>;
        stateMember.note = note;
        stateMember.note.text = sanitizeText(stateMember.note.text);
      }
    }

    if (classes) {
      const classesList = Array.isArray(classes) ? classes : [classes];
      classesList.forEach((cssClass) => this.setCssClass(trimmedId, cssClass.trim()));
    }

    if (styles) {
      const stylesList = Array.isArray(styles) ? styles : [styles];
      stylesList.forEach((style) => this.setStyle(trimmedId, style.trim()));
    }

    if (textStyles) {
      const textStylesList = Array.isArray(textStyles) ? textStyles : [textStyles];
      textStylesList.forEach((textStyle) => this.setTextStyle(trimmedId, textStyle.trim()));
    }
  }

  public clear(saveCommon?: boolean): void {
    this.nodes = [];
    this.edges = [];
    this.documents = { root: newDoc() };
    this.currentDocument = this.documents.root;
    this.startEndCount = 0;
    this.classes = newClassesList();
    this.nodeDb = new Map();
    this.graphItemCount = 0;
    if (!saveCommon) {
      this.links = new Map();
      this.accTitleValue = undefined;
      this.accDescriptionValue = undefined;
    }
  }

  public getState(id: string): StateStmt | undefined {
    return this.currentDocument.states.get(id);
  }

  public getStates(): Map<string, StateStmt> {
    return this.currentDocument.states;
  }

  public getRelations(): Array<{ id1: string; id2: string; relationTitle?: string }> {
    return this.currentDocument.relations;
  }

  public addLink(stateId: string, url: string, tooltip: string): void {
    this.links.set(stateId, { url, tooltip });
  }

  public getLinks(): Map<string, StateLinkInfo> {
    return this.links;
  }

  public startIdIfNeeded(id = ''): string {
    if (id === START_NODE) {
      this.startEndCount++;
      return `${START_TYPE}${this.startEndCount}`;
    }
    return id;
  }

  public startTypeIfNeeded(
    id = '',
    type: StateNodeType = DEFAULT_STATE_TYPE as StateNodeType,
  ): StateNodeType {
    return id === START_NODE ? (START_TYPE as StateNodeType) : type;
  }

  public endIdIfNeeded(id = ''): string {
    if (id === END_NODE) {
      this.startEndCount++;
      return `${END_TYPE}${this.startEndCount}`;
    }
    return id;
  }

  public endTypeIfNeeded(
    id = '',
    type: StateNodeType = DEFAULT_STATE_TYPE as StateNodeType,
  ): StateNodeType {
    return id === END_NODE ? (END_TYPE as StateNodeType) : type;
  }

  private addRelationObjs(
    item1: StateStmt,
    item2: StateStmt,
    relationTitle = '',
  ): void {
    const state1 = item1 as Extract<StateStmt, { stmt: 'state' }>;
    const state2 = item2 as Extract<StateStmt, { stmt: 'state' }>;
    const id1 = this.startIdIfNeeded(state1.id.trim());
    const type1 = this.startTypeIfNeeded(state1.id.trim(), state1.type);
    const id2 = this.startIdIfNeeded(state2.id.trim());
    const type2 = this.startTypeIfNeeded(state2.id.trim(), state2.type);

    this.addState(
      id1,
      type1,
      state1.doc,
      state1.description,
      state1.note,
      state1.classes,
      state1.styles,
      state1.textStyles,
    );
    this.addState(
      id2,
      type2,
      state2.doc,
      state2.description,
      state2.note,
      state2.classes,
      state2.styles,
      state2.textStyles,
    );
    this.currentDocument.relations.push({
      id1,
      id2,
      relationTitle: relationTitle ? sanitizeText(relationTitle) : undefined,
    });
  }

  public addRelation(
    item1: StateStmtRef,
    item2: StateStmtRef,
    title?: string,
  ): void {
    if (typeof item1 === 'object' && typeof item2 === 'object') {
      this.addRelationObjs(item1, item2, title);
    } else if (typeof item1 === 'string' && typeof item2 === 'string') {
      const id1 = this.startIdIfNeeded(item1.trim());
      const type1 = this.startTypeIfNeeded(item1);
      const id2 = this.endIdIfNeeded(item2.trim());
      const type2 = this.endTypeIfNeeded(item2);

      this.addState(id1, type1);
      this.addState(id2, type2);
      this.currentDocument.relations.push({
        id1,
        id2,
        relationTitle: title ? sanitizeText(title) : undefined,
      });
    }
  }

  public addDescription(id: string, descr: string): void {
    const theState = this.currentDocument.states.get(id);
    const _descr = descr.startsWith(':') ? descr.replace(':', '').trim() : descr;
    if (theState && theState.stmt === 'state') {
      const stateMember = theState as Extract<StateStmt, { stmt: 'state' }>;
      if (!stateMember.descriptions) {
        stateMember.descriptions = [];
      }
      stateMember.descriptions.push(sanitizeText(_descr));
    }
  }

  public cleanupLabel(label: string): string {
    return label.startsWith(':') ? label.slice(2).trim() : label.trim();
  }

  public getDividerId(): string {
    this.dividerCnt++;
    return `divider-id-${this.dividerCnt}`;
  }

  public addStyleClass(id: string, styleAttributes = ''): void {
    if (!this.classes.has(id)) {
      this.classes.set(id, { id, styles: [], textStyles: [] });
    }
    const foundClass = this.classes.get(id);
    if (styleAttributes && foundClass) {
      styleAttributes.split(STYLECLASS_SEP).forEach((attrib) => {
        const fixedAttrib = attrib.replace(/([^;]*);/, '$1').trim();
        if (RegExp(COLOR_KEYWORD).exec(attrib)) {
          const newStyle1 = fixedAttrib.replace(FILL_KEYWORD, BG_FILL);
          const newStyle2 = newStyle1.replace(COLOR_KEYWORD, FILL_KEYWORD);
          foundClass.textStyles.push(newStyle2);
        }
        foundClass.styles.push(fixedAttrib);
      });
    }
  }

  public getClasses(): Map<string, StateStyleClass> {
    return this.classes;
  }

  public setCssClass(itemIds: string, cssClassName: string): void {
    itemIds.split(',').forEach((id) => {
      let foundState = this.getState(id);
      if (!foundState) {
        const trimmedId = id.trim();
        this.addState(trimmedId);
        foundState = this.getState(trimmedId);
      }
      if (foundState && foundState.stmt === 'state') {
        const stateMember = foundState as Extract<StateStmt, { stmt: 'state' }>;
        if (!stateMember.classes) {
          stateMember.classes = [];
        }
        stateMember.classes.push(cssClassName);
      }
    });
  }

  public setStyle(itemId: string, styleText: string): void {
    const state = this.getState(itemId);
    if (state && state.stmt === 'state') {
      const stateMember = state as Extract<StateStmt, { stmt: 'state' }>;
      if (!stateMember.styles) {
        stateMember.styles = [];
      }
      stateMember.styles.push(styleText);
    }
  }

  public setTextStyle(itemId: string, cssClassName: string): void {
    const state = this.getState(itemId);
    if (state && state.stmt === 'state') {
      const stateMember = state as Extract<StateStmt, { stmt: 'state' }>;
      if (!stateMember.textStyles) {
        stateMember.textStyles = [];
      }
      stateMember.textStyles.push(cssClassName);
    }
  }

  private getDirectionStatement(): DirectionStmt | undefined {
    return this.rootDoc.find(
      (doc): doc is DirectionStmt => doc.stmt === STMT_DIRECTION,
    );
  }

  public getDirection(): string {
    return this.getDirectionStatement()?.value ?? DEFAULT_DIAGRAM_DIRECTION;
  }

  public setDirection(dir: FlowchartDirection): void {
    const doc = this.getDirectionStatement();
    if (doc) {
      doc.value = dir;
    } else {
      this.rootDoc.unshift({ stmt: STMT_DIRECTION, value: dir } as StateStmt);
    }
  }

  public trimColon(str: string): string {
    return str.startsWith(':') ? str.slice(1).trim() : str.trim();
  }

  public getAccTitle(): string | undefined {
    return this.accTitleValue;
  }

  public setAccTitle(title: string): void {
    this.accTitleValue = title;
  }

  public getAccDescription(): string | undefined {
    return this.accDescriptionValue;
  }

  public setAccDescription(descr: string): void {
    this.accDescriptionValue = descr;
  }

  public getData(): StateDBData {
    return {
      nodes: this.nodes,
      edges: this.edges,
      other: {},
      direction: this.getDirection(),
    };
  }

  private dataFetcher(
    parent: StateStmt | undefined,
    parsedItem: StateStmt & { id: string; doc?: StateStmt[] },
    diagramStates: Map<string, StateStmt>,
    altFlag: boolean,
  ): void {
    const itemId = parsedItem.id;
    const dbState = diagramStates.get(itemId);
    const classStr = getClassesFromDbInfo(dbState);
    const style = getStylesFromDbInfo(dbState);

    if (itemId !== 'root') {
      let shape = SHAPE_STATE;
      const parsedStart = (parsedItem as { start?: boolean }).start;
      if (parsedStart === true) {
        shape = SHAPE_START;
      } else if (parsedStart === false) {
        shape = SHAPE_END;
      }
      const parsedItemType = (parsedItem as { type?: StateNodeType }).type;
      if (parsedItemType !== undefined && parsedItemType !== DEFAULT_STATE_TYPE) {
        shape = parsedItemType;
      }

      if (!this.nodeDb.has(itemId)) {
        this.nodeDb.set(itemId, {
          id: itemId,
          shape,
          description: sanitizeText(itemId),
          cssClasses: `${classStr} ${CSS_DIAGRAM_STATE}`,
          cssStyles: style,
        });
      }

      const newNode = this.nodeDb.get(itemId);
      if (!newNode) {
        throw new Error(`Failed to get node from nodeDb: ${itemId}`);
      }

      // 官方 mermaid 使用 truthy 检查（空字符串 '' 被跳过）
      // jison 对所有 idStatement 默认设置 description: ''，必须跳过否则会覆盖 SHAPE_START/END/choice/fork/join
      const parsedDescription = (parsedItem as { description?: string | string[] }).description;
      if (parsedDescription) {
        if (Array.isArray(newNode.description)) {
          newNode.shape = SHAPE_STATE_WITH_DESC;
          newNode.description.push(parsedDescription as string);
        } else if (
          typeof newNode.description === 'string' &&
          newNode.description.length > 0
        ) {
          newNode.shape = SHAPE_STATE_WITH_DESC;
          if (newNode.description === itemId) {
            newNode.description = [parsedDescription as string];
          } else {
            newNode.description = [
              newNode.description,
              parsedDescription as string,
            ];
          }
        } else {
          newNode.shape = SHAPE_STATE;
          newNode.description = parsedDescription;
        }
      }

      // 官方使用 newNode.description?.length === 1（兼容字符串和数组）
      // 我们对齐官方逻辑
      if (
        newNode.description &&
        typeof newNode.description === 'object' &&
        Array.isArray(newNode.description) &&
        newNode.description.length === 1 &&
        newNode.shape === SHAPE_STATE_WITH_DESC
      ) {
        if (newNode.type === 'group') {
          newNode.shape = SHAPE_GROUP;
        } else {
          newNode.shape = SHAPE_STATE;
        }
      }

      if (!newNode.type && parsedItem.doc) {
        newNode.type = 'group';
        newNode.isGroup = true;
        newNode.dir = getDirFromStmt(parsedItem);
        newNode.explicitDir = parsedItem.doc.some((s) => s.stmt === 'dir');
        newNode.shape =
          (parsedItem as { type?: string }).type === DIVIDER_TYPE
            ? SHAPE_DIVIDER
            : SHAPE_GROUP;
        newNode.cssClasses = `${newNode.cssClasses ?? ''} ${CSS_DIAGRAM_CLUSTER} ${
          altFlag ? CSS_DIAGRAM_CLUSTER_ALT : ''
        }`;
      }

      const nodeData: StateDBNode = {
        labelStyle: '',
        shape: newNode.shape,
        label: newNode.description,
        cssClasses: newNode.cssClasses,
        cssCompiledStyles: [],
        cssStyles: newNode.cssStyles ?? [],
        id: itemId,
        ...(newNode.dir ? { dir: newNode.dir } : {}),
        domId: stateDomId(itemId, this.graphItemCount),
        type: newNode.type,
        isGroup: newNode.type === 'group',
        padding: 8,
        rx: 10,
        ry: 10,
        look: DEFAULT_LOOK,
        labelType: 'markdown',
      };

      if (nodeData.shape === SHAPE_DIVIDER) {
        nodeData.label = '';
      }

      const parentId = (parent as { id?: string } | undefined)?.id;
      if (parentId !== undefined && parentId !== 'root') {
        nodeData.parentId = parentId;
      }

      nodeData.centerLabel = true;

      const parsedNote = (parsedItem as { note?: InternalNote }).note;
      if (parsedNote) {
        const noteData: StateDBNode = {
          labelStyle: '',
          shape: SHAPE_NOTE,
          label: parsedNote.text,
          labelType: 'markdown',
          cssClasses: CSS_DIAGRAM_NOTE,
          cssStyles: [],
          cssCompiledStyles: [],
          id: itemId + NOTE_ID + '-' + this.graphItemCount,
          domId: stateDomId(itemId, this.graphItemCount, NOTE),
          type: newNode.type,
          isGroup: newNode.type === 'group',
          look: DEFAULT_LOOK,
          position: parsedNote.position,
        };
        const parentNodeId = itemId + PARENT_ID;
        const groupData: StateDBNode = {
          labelStyle: '',
          shape: SHAPE_NOTEGROUP,
          label: parsedNote.text,
          cssClasses: newNode.cssClasses,
          cssStyles: [],
          id: parentNodeId,
          domId: stateDomId(itemId, this.graphItemCount, PARENT),
          type: 'group',
          isGroup: true,
          padding: 16,
          look: DEFAULT_LOOK,
          position: parsedNote.position,
        };
        this.graphItemCount++;

        groupData.id = parentNodeId;
        noteData.parentId = parentNodeId;

        this.insertOrUpdateNode(groupData);
        this.insertOrUpdateNode(noteData);
        this.insertOrUpdateNode(nodeData);

        let from = itemId;
        let to = noteData.id;
        if (parsedNote.position === 'left of') {
          from = noteData.id;
          to = itemId;
        }
        this.edges.push({
          id: `${from}-${to}`,
          start: from,
          end: to,
          arrowhead: 'none',
          arrowTypeEnd: '',
          style: G_EDGE_STYLE,
          labelStyle: '',
          classes: CSS_EDGE_NOTE_EDGE,
          arrowheadStyle: G_EDGE_ARROWHEADSTYLE,
          labelpos: G_EDGE_LABELPOS,
          labelType: G_EDGE_LABELTYPE,
          thickness: G_EDGE_THICKNESS,
        });
      } else {
        this.insertOrUpdateNode(nodeData);
      }
    }

    if (parsedItem.doc) {
      this.setupDoc(
        parsedItem as StateStmt,
        parsedItem.doc,
        diagramStates,
        !altFlag,
      );
    }
  }

  private setupDoc(
    parentParsedItem: StateStmt,
    doc: StateStmt[],
    diagramStates: Map<string, StateStmt>,
    altFlag: boolean,
  ): void {
    for (const item of doc) {
      switch (item.stmt) {
        case STMT_STATE: {
          this.dataFetcher(
            parentParsedItem,
            item as StateStmt & { id: string; doc?: StateStmt[] },
            diagramStates,
            altFlag,
          );
          break;
        }
        case STMT_RELATION: {
          const relItem = item as Extract<StateStmt, { stmt: 'relation' }>;
          if (typeof relItem.state1 === 'object') {
            this.dataFetcher(
              parentParsedItem,
              relItem.state1 as StateStmt & { id: string; doc?: StateStmt[] },
              diagramStates,
              altFlag,
            );
          }
          if (typeof relItem.state2 === 'object') {
            this.dataFetcher(
              parentParsedItem,
              relItem.state2 as StateStmt & { id: string; doc?: StateStmt[] },
              diagramStates,
              altFlag,
            );
          }
          const state1Id =
            typeof relItem.state1 === 'string'
              ? relItem.state1
              : (relItem.state1 as { id: string }).id;
          const state2Id =
            typeof relItem.state2 === 'string'
              ? relItem.state2
              : (relItem.state2 as { id: string }).id;
          this.edges.push({
            id: 'edge' + this.graphItemCount,
            start: state1Id,
            end: state2Id,
            arrowhead: 'normal',
            arrowTypeEnd: 'arrow_barb',
            style: G_EDGE_STYLE,
            labelStyle: '',
            label: (relItem.description ?? '').trim(),
            arrowheadStyle: G_EDGE_ARROWHEADSTYLE,
            labelpos: G_EDGE_LABELPOS,
            labelType: G_EDGE_LABELTYPE,
            thickness: G_EDGE_THICKNESS,
            classes: CSS_EDGE,
          });
          this.graphItemCount++;
          break;
        }
      }
    }
  }

  private insertOrUpdateNode(nodeData: StateDBNode): void {
    if (
      !nodeData.id ||
      nodeData.id === '</join></fork>' ||
      nodeData.id === '</choice>'
    ) {
      return;
    }

    if (nodeData.cssClasses) {
      if (!Array.isArray(nodeData.cssCompiledStyles)) {
        nodeData.cssCompiledStyles = [];
      }
      nodeData.cssClasses.split(' ').forEach((cssClass) => {
        const classDef = this.classes.get(cssClass);
        if (classDef) {
          nodeData.cssCompiledStyles = [
            ...(nodeData.cssCompiledStyles ?? []),
            ...classDef.styles,
          ];
        }
      });
    }

    const existingNodeData = this.nodes.find((node) => node.id === nodeData.id);
    if (existingNodeData) {
      Object.assign(existingNodeData, nodeData);
    } else {
      this.nodes.push(nodeData);
    }
  }
}
