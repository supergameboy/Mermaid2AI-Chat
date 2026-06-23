/**
 * SequenceDB — 官方 mermaid `sequenceDb.ts` 的纯 TypeScript 移植
 *
 * 单一职责：jison parser 调用此类的实例方法收集 AST 数据
 *
 * 与官方的差异:
 *   - 移除 getConfig 依赖（使用默认配置）
 *   - 移除 document/Option/window.CSS 依赖（parseBoxData 颜色校验改为纯函数正则）
 *   - 移除 sanitizeText 依赖（HTML 转义由渲染层负责）
 *   - 移除 commonClear/setAccTitle 等 commonDb 依赖（在本地实现）
 *   - 移除 ImperativeState 依赖（使用直接字段）
 *   - 移除 log 依赖（解析层不输出日志）
 *   - 移除 yaml 依赖（addActor 的 metadata 简化为可选字段透传）
 *   - 移除 addDetails（依赖 document.getElementById，不在解析层支持）
 *   - 适配 TypeScript 严格模式（禁止 any，禁止 ! 非空断言）
 *   - 保留 addActor/addMessage/addSignal/addNote/addLinks/addALink/addProperties/addBox/apply 逻辑
 *
 * 数据流:
 *   jison parser → SequenceDB.apply(param) → 分发到 addActor/addMessage/... → SequenceDB.getData() → SequenceAST
 *
 * 注意:
 *   - jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
 *   - LINETYPE/ARROWTYPE/PLACEMENT 作为实例属性挂载，供 jison 语法动作引用
 */

import type { Actor, AddMessageParams, Box, Message, Note } from './types.js';
import type { SequenceAST } from '../../ast/sequence-ast.js';
import {
  LINETYPE,
  ARROWTYPE,
  PLACEMENT,
  PARTICIPANT_TYPE,
} from './constants.js';

// ============================================================
// 内部类型
// ============================================================

/** Sequence 解析器内部状态 */
interface SequenceState {
  prevActor: string | undefined;
  actors: Map<string, Actor>;
  createdActors: Map<string, number>;
  destroyedActors: Map<string, number>;
  boxes: Box[];
  messages: Message[];
  notes: Note[];
  sequenceNumbersEnabled: boolean;
  wrapEnabled: boolean | undefined;
  currentBox: Box | undefined;
  lastCreated: Actor | undefined;
  lastDestroyed: Actor | undefined;
  accTitle: string | undefined;
  accDescription: string | undefined;
  diagramTitle: string | undefined;
}

/** 参与者元数据（简化版，不做 YAML 解析） */
interface ParticipantMetaData {
  type?: string;
  alias?: string;
}

/** jison parser 调用的 yy 对象接口 */
export interface SequenceDBYY {
  apply: SequenceDB['apply'];
  parseBoxData: SequenceDB['parseBoxData'];
  parseMessage: SequenceDB['parseMessage'];
  setAccTitle: SequenceDB['setAccTitle'];
  setAccDescription: SequenceDB['setAccDescription'];
  setDiagramTitle: SequenceDB['setDiagramTitle'];
  LINETYPE: typeof LINETYPE;
  ARROWTYPE: typeof ARROWTYPE;
  PLACEMENT: typeof PLACEMENT;
}

/** 颜色正则（rgb/rgba/hsl/hsla 或 CSS 颜色名） */
const COLOR_REGEX = /^(rgba?|hsla?)\s*\(.*\)$/i;
/** 常用 CSS 颜色名 */
const CSS_COLOR_NAMES = new Set([
  'transparent', 'black', 'white', 'red', 'green', 'blue', 'yellow', 'cyan', 'magenta',
  'gray', 'grey', 'orange', 'purple', 'pink', 'brown', 'navy', 'teal', 'olive',
  'maroon', 'aqua', 'fuchsia', 'lime', 'silver',
]);

// ============================================================
// SequenceDB 类
// ============================================================

/**
 * SequenceDB — sequence 解析数据收集器
 *
 * 实例方法被 jison parser 通过 `yy.methodName()` 调用
 * 所有 jison 调用的方法在构造函数中 bind，确保 this 指向正确
 */
export class SequenceDB {
  private state: SequenceState = createInitialState();

  // 常量作为实例属性挂载（jison 通过 yy.LINETYPE 访问）
  public readonly LINETYPE = LINETYPE;
  public readonly ARROWTYPE = ARROWTYPE;
  public readonly PLACEMENT = PLACEMENT;

  constructor() {
    // jison 只支持直接属性，因此所有 jison 调用的方法都在构造函数中 bind
    this.apply = this.apply.bind(this);
    this.parseBoxData = this.parseBoxData.bind(this);
    this.parseMessage = this.parseMessage.bind(this);
    this.addActor = this.addActor.bind(this);
    this.addMessage = this.addMessage.bind(this);
    this.addSignal = this.addSignal.bind(this);
    this.addNote = this.addNote.bind(this);
    this.addLinks = this.addLinks.bind(this);
    this.addALink = this.addALink.bind(this);
    this.addProperties = this.addProperties.bind(this);
    this.addBox = this.addBox.bind(this);
    this.enableSequenceNumbers = this.enableSequenceNumbers.bind(this);
    this.disableSequenceNumbers = this.disableSequenceNumbers.bind(this);
    this.setWrap = this.setWrap.bind(this);
    this.setAccTitle = this.setAccTitle.bind(this);
    this.setAccDescription = this.setAccDescription.bind(this);
    this.setDiagramTitle = this.setDiagramTitle.bind(this);

    this.clear();
  }

  // ============================================================
  // 状态管理
  // ============================================================

  /** 重置状态 */
  public clear(): void {
    this.state = createInitialState();
  }

  /** 创建初始状态 */
  private static createInitialState(): SequenceState {
    return createInitialState();
  }

  // ============================================================
  // Box（参与者分组）
  // ============================================================

  /** 添加 box（jison 调用） */
  public addBox(data: { text: string; color: string; wrap: boolean }): void {
    const box: Box = {
      name: data.text,
      wrap: data.wrap ?? this.autoWrap(),
      fill: data.color,
      actorKeys: [],
    };
    this.state.boxes.push(box);
    this.state.currentBox = box;
  }

  /** box 结束（jison 通过 apply('boxEnd') 调用） */
  private boxEnd(): void {
    this.state.currentBox = undefined;
  }

  // ============================================================
  // Actor（参与者）
  // ============================================================

  /** 添加参与者（jison 调用） */
  public addActor(
    id: string,
    name: string,
    description: { text: string; wrap?: boolean | null; type: string },
    type: string,
    metadata?: unknown,
  ): void {
    let assignedBox = this.state.currentBox;
    let doc: ParticipantMetaData | undefined;

    if (metadata !== undefined && typeof metadata === 'string') {
      doc = this.parseParticipantMetadata(metadata);
    }

    const effectiveType = doc?.type ?? type;

    // 若 metadata 提供了 alias 且 description 未显式设置，使用 alias
    if (doc?.alias && (!description || description.text === name)) {
      description = { text: doc.alias, wrap: description?.wrap ?? undefined, type: effectiveType };
    }

    const old = this.state.actors.get(id);
    if (old) {
      // 已存在：检查 box 冲突
      if (this.state.currentBox && old.box && this.state.currentBox !== old.box) {
        throw new Error(
          `A same participant should only be defined in one Box: ${old.name} can't be in '${old.box.name}' and in '${this.state.currentBox.name}' at the same time.`,
        );
      }

      // 不改变已设置的 box
      assignedBox = old.box ? old.box : this.state.currentBox;
      old.box = assignedBox;

      // 不允许 nulling description
      if (old && name === old.name && description == null) {
        return;
      }
    }

    // 不允许 null description
    if (description?.text == null) {
      description = { text: name, type: effectiveType };
    }
    if (effectiveType == null || description.text == null) {
      description = { text: name, type: effectiveType };
    }

    const actor: Actor = {
      box: assignedBox,
      name: name,
      description: description.text,
      wrap: description.wrap ?? this.autoWrap(),
      prevActor: this.state.prevActor,
      links: {},
      properties: {},
      actorCnt: null,
      rectData: null,
      type: effectiveType ?? PARTICIPANT_TYPE.PARTICIPANT,
    };

    this.state.actors.set(id, actor);

    // 双向链接 prevActor
    if (this.state.prevActor) {
      const prevActorInRecords = this.state.actors.get(this.state.prevActor);
      if (prevActorInRecords) {
        prevActorInRecords.nextActor = id;
      }
    }

    // 加入当前 box 的 actorKeys
    if (this.state.currentBox) {
      this.state.currentBox.actorKeys.push(id);
    }

    this.state.prevActor = id;
  }

  /** 解析参与者元数据（简化版，不依赖 yaml） */
  private parseParticipantMetadata(metadata: string): ParticipantMetaData {
    // 简化处理：仅识别 type 和 alias 字段
    // 官方使用 yaml.load，此处用简单正则避免引入 yaml 依赖
    const result: ParticipantMetaData = {};
    const typeMatch = /type:\s*['"]?([^'"\n,}]+)['"]?/i.exec(metadata);
    if (typeMatch) {
      result.type = typeMatch[1].trim();
    }
    const aliasMatch = /alias:\s*['"]?([^'"\n,}]+)['"]?/i.exec(metadata);
    if (aliasMatch) {
      result.alias = aliasMatch[1].trim();
    }
    return result;
  }

  // ============================================================
  // Message（消息/信号）
  // ============================================================

  /** 计算参与者激活次数 */
  private activationCount(part: string): number {
    if (!part) {
      return 0;
    }
    let count = 0;
    for (const msg of this.state.messages) {
      if (msg.type === LINETYPE.ACTIVE_START && msg.from === part) {
        count++;
      }
      if (msg.type === LINETYPE.ACTIVE_END && msg.from === part) {
        count--;
      }
    }
    return count;
  }

  /** 添加消息（jison 调用） */
  public addMessage(
    idFrom: Message['from'],
    idTo: Message['to'],
    message: { text: string; wrap?: boolean },
    answer: Message['answer'],
  ): void {
    this.state.messages.push({
      id: this.state.messages.length,
      from: idFrom,
      to: idTo,
      message: message.text,
      wrap: message.wrap ?? this.autoWrap(),
      answer: answer,
    });
  }

  /** 添加信号（jison 调用） */
  public addSignal(
    idFrom?: Message['from'],
    idTo?: Message['to'],
    message?: { text: string; wrap: boolean },
    messageType?: number,
    activate = false,
    centralConnection?: number,
  ): boolean {
    if (messageType === LINETYPE.ACTIVE_END) {
      const cnt = this.activationCount(idFrom ?? '');
      if (cnt < 1) {
        // 试图 deactivate 未激活的参与者
        const error = new Error(
          'Trying to inactivate an inactive participant (' + idFrom + ')',
        );
        // 模拟 jison 错误 hash（不破坏类型安全）
        (error as Error & { hash: unknown }).hash = {
          text: '->>-',
          token: '->>-',
          line: '1',
          loc: { first_line: 1, last_line: 1, first_column: 1, last_column: 1 },
          expected: ["'ACTIVE_PARTICIPANT'"],
        };
        throw error;
      }
    }
    this.state.messages.push({
      id: this.state.messages.length,
      from: idFrom,
      to: idTo,
      message: message?.text ?? '',
      wrap: message?.wrap ?? this.autoWrap(),
      type: messageType,
      activate,
      centralConnection: centralConnection ?? 0,
    });
    return true;
  }

  // ============================================================
  // Note（注释）
  // ============================================================

  /**
   * 添加 Note（jison 调用）
   *
   * actor 参数可以是：
   *   - 字符串（left of/right of 单个参与者）
   *   - 字符串数组（over 多个参与者）
   *   - { actor: string } 对象（兼容旧格式）
   */
  public addNote(
    actor: string | string[] | { actor: string },
    placement: Message['placement'],
    message: { text: string; wrap?: boolean },
  ): void {
    // 提取参与者 ID
    let actorId: string;
    let actorObj: { actor: string };
    if (typeof actor === 'string') {
      actorId = actor;
      actorObj = { actor };
    } else if (Array.isArray(actor)) {
      // over 多个参与者：取第一个作为主参与者
      actorId = actor[0] ?? '';
      actorObj = { actor: actorId };
    } else {
      actorId = actor.actor;
      actorObj = actor;
    }

    const note: Note = {
      actor: actorObj,
      placement: placement,
      message: message.text,
      wrap: message.wrap ?? this.autoWrap(),
    };

    this.state.notes.push(note);
    this.state.messages.push({
      id: this.state.messages.length,
      from: actorId,
      to: actorId,
      message: message.text,
      wrap: message.wrap ?? this.autoWrap(),
      type: LINETYPE.NOTE,
      placement: placement,
    });
  }

  // ============================================================
  // Links / Properties
  // ============================================================

  /** 添加参与者链接（JSON 格式，jison 调用） */
  public addLinks(actorId: string, text: { text: string }): void {
    const actor = this.getActor(actorId);
    try {
      let sanitizedText = text.text.replace(/&equals;/g, '=').replace(/&amp;/g, '&');
      const links = JSON.parse(sanitizedText) as Record<string, unknown>;
      this.insertLinks(actor, links as Record<string, string>);
    } catch {
      // 解析失败：忽略链接（对齐官方 error log 行为）
    }
  }

  /** 添加单个链接（label@url 格式，jison 调用） */
  public addALink(actorId: string, text: { text: string }): void {
    const actor = this.getActor(actorId);
    try {
      const links: Record<string, string> = {};
      let sanitizedText = text.text.replace(/&equals;/g, '=').replace(/&amp;/g, '&');
      const sep = sanitizedText.indexOf('@');
      const label = sanitizedText.slice(0, sep - 1).trim();
      const link = sanitizedText.slice(sep + 1).trim();
      links[label] = link;
      this.insertLinks(actor, links);
    } catch {
      // 解析失败：忽略链接
    }
  }

  /** 插入链接到 actor */
  private insertLinks(actor: Actor, links: Record<string, string>): void {
    if (actor.links == null) {
      actor.links = links;
    } else {
      for (const key in links) {
        if (Object.prototype.hasOwnProperty.call(links, key)) {
          actor.links[key] = links[key];
        }
      }
    }
  }

  /** 添加参与者属性（JSON 格式，jison 调用） */
  public addProperties(actorId: string, text: { text: string }): void {
    const actor = this.getActor(actorId);
    try {
      const properties = JSON.parse(text.text) as Record<string, unknown>;
      this.insertProperties(actor, properties);
    } catch {
      // 解析失败：忽略属性
    }
  }

  /** 插入属性到 actor */
  private insertProperties(actor: Actor, properties: Record<string, unknown>): void {
    if (actor.properties == null) {
      actor.properties = properties;
    } else {
      for (const key in properties) {
        if (Object.prototype.hasOwnProperty.call(properties, key)) {
          actor.properties[key] = properties[key];
        }
      }
    }
  }

  // ============================================================
  // Wrap 设置
  // ============================================================

  /** 设置 wrap（jison 调用） */
  public setWrap(wrapSetting: boolean | undefined): void {
    this.state.wrapEnabled = wrapSetting;
  }

  /** 自动 wrap（未显式设置时使用默认值 false） */
  public autoWrap(): boolean {
    return this.state.wrapEnabled ?? false;
  }

  /** 从文本中提取 wrap 标记 */
  private extractWrap(text: string | undefined): { cleanedText: string | undefined; wrap: boolean | undefined } {
    if (text === undefined) {
      return { cleanedText: undefined, wrap: undefined };
    }
    const trimmed = text.trim();
    const wrap =
      /^:?wrap:/.exec(trimmed) !== null
        ? true
        : /^:?nowrap:/.exec(trimmed) !== null
          ? false
          : undefined;
    const cleanedText = (wrap === undefined ? trimmed : trimmed.replace(/^:?(?:no)?wrap:/, '')).trim();
    return { cleanedText, wrap };
  }

  /** 解析消息文本（jison 调用） */
  public parseMessage(str: string): { text: string; wrap: boolean | undefined } {
    const trimmedStr = str.trim();
    const { wrap, cleanedText } = this.extractWrap(trimmedStr);
    return {
      text: cleanedText ?? '',
      wrap,
    };
  }

  /**
   * 解析 box 数据（jison 调用）
   * 格式：color first then description
   * color 可以是 rgb/rgba/hsl/hsla 或 CSS 颜色名
   */
  public parseBoxData(str: string): { text: string | undefined; color: string; wrap: boolean | undefined } {
    const match = /^((?:rgba?|hsla?)\s*\(.*\)|\w*)(.*)$/s.exec(str);
    let color = match?.[1] ? match[1].trim() : 'transparent';
    let title = match?.[2] ? match[2].trim() : undefined;

    // 颜色校验（不依赖 DOM）
    if (color && !COLOR_REGEX.test(color) && !CSS_COLOR_NAMES.has(color.toLowerCase())) {
      // 不是合法颜色：将整行作为 title
      color = 'transparent';
      title = str.trim();
    }

    const { wrap, cleanedText } = this.extractWrap(title);
    return {
      text: cleanedText || undefined,
      color,
      wrap,
    };
  }

  // ============================================================
  // Sequence Numbers（自动编号）
  // ============================================================

  public enableSequenceNumbers(): void {
    this.state.sequenceNumbersEnabled = true;
  }

  public disableSequenceNumbers(): void {
    this.state.sequenceNumbersEnabled = false;
  }

  public showSequenceNumbers(): boolean {
    return this.state.sequenceNumbersEnabled;
  }

  // ============================================================
  // Accessibility / Title
  // ============================================================

  public setAccTitle(title: string): void {
    this.state.accTitle = title;
  }

  public getAccTitle(): string | undefined {
    return this.state.accTitle;
  }

  public setAccDescription(desc: string): void {
    this.state.accDescription = desc;
  }

  public getAccDescription(): string | undefined {
    return this.state.accDescription;
  }

  public setDiagramTitle(title: string): void {
    this.state.diagramTitle = title;
  }

  public getDiagramTitle(): string | undefined {
    return this.state.diagramTitle;
  }

  // ============================================================
  // Getters
  // ============================================================

  public getActors(): Map<string, Actor> {
    return this.state.actors;
  }

  public getActor(id: string): Actor {
    const actor = this.state.actors.get(id);
    if (!actor) {
      throw new Error(`Actor not found: ${id}`);
    }
    return actor;
  }

  public getActorKeys(): string[] {
    return [...this.state.actors.keys()];
  }

  public getMessages(): Message[] {
    return this.state.messages;
  }

  public getNotes(): Note[] {
    return this.state.notes;
  }

  public getBoxes(): Box[] {
    return this.state.boxes;
  }

  public getCreatedActors(): Map<string, number> {
    return this.state.createdActors;
  }

  public getDestroyedActors(): Map<string, number> {
    return this.state.destroyedActors;
  }

  public hasAtLeastOneBox(): boolean {
    return this.state.boxes.length > 0;
  }

  public hasAtLeastOneBoxWithTitle(): boolean {
    return this.state.boxes.some((b) => b.name);
  }

  public getActorProperty(actor: Actor, key: string): unknown {
    if (actor?.properties !== undefined) {
      return actor.properties[key];
    }
    return undefined;
  }

  // ============================================================
  // apply — jison 批量分发入口
  // ============================================================

  /** 批量应用操作（jison 调用） */
  public apply(param: AddMessageParams | AddMessageParams[] | Record<string, unknown>): void {
    if (Array.isArray(param)) {
      for (const item of param) {
        this.apply(item);
      }
      return;
    }

    const obj = param as Record<string, unknown>;
    const type = obj.type as string;

    switch (type) {
      case 'sequenceIndex':
        this.state.messages.push({
          id: this.state.messages.length,
          from: undefined,
          to: undefined,
          message: {
            start: obj.sequenceIndex as number,
            step: obj.sequenceIndexStep as number,
            visible: obj.sequenceVisible as boolean,
          },
          wrap: false,
          type: obj.signalType as number,
        });
        break;

      case 'addParticipant':
        this.addActor(
          obj.actor as string,
          obj.actor as string,
          obj.description as { text: string; wrap?: boolean | null; type: string },
          obj.draw as string,
          obj.config,
        );
        break;

      case 'createParticipant': {
        if (this.state.actors.has(obj.actor as string)) {
          throw new Error(
            "It is not possible to have actors with the same id, even if one is destroyed before the next is created. Use 'AS' aliases to simulate the behavior",
          );
        }
        const actorObj: Actor = {
          box: undefined,
          name: obj.actor as string,
          description: (obj.description as { text: string })?.text ?? (obj.actor as string),
          wrap: this.autoWrap(),
          prevActor: this.state.prevActor,
          links: {},
          properties: {},
          actorCnt: null,
          rectData: null,
          type: (obj.draw as string) ?? PARTICIPANT_TYPE.PARTICIPANT,
        };
        this.state.lastCreated = actorObj;
        this.addActor(
          obj.actor as string,
          obj.actor as string,
          obj.description as { text: string; wrap?: boolean | null; type: string },
          obj.draw as string,
          obj.config,
        );
        this.state.createdActors.set(obj.actor as string, this.state.messages.length);
        break;
      }

      case 'destroyParticipant': {
        const actor = this.state.actors.get(obj.actor as string);
        if (actor) {
          this.state.lastDestroyed = actor;
        }
        this.state.destroyedActors.set(obj.actor as string, this.state.messages.length);
        break;
      }

      case 'activeStart':
        this.addSignal(obj.actor as string, undefined, undefined, obj.signalType as number);
        break;

      case 'centralConnection':
      case 'centralConnectionReverse':
      case 'activeEnd':
        this.addSignal(obj.actor as string, undefined, undefined, obj.signalType as number);
        break;

      case 'addNote':
        this.addNote(
          obj.actor as string | string[] | { actor: string },
          obj.placement as Message['placement'],
          obj.text as { text: string; wrap?: boolean },
        );
        break;

      case 'addLinks':
        this.addLinks(obj.actor as string, obj.text as { text: string });
        break;

      case 'addALink':
        this.addALink(obj.actor as string, obj.text as { text: string });
        break;

      case 'addProperties':
        this.addProperties(obj.actor as string, obj.text as { text: string });
        break;

      case 'addMessage': {
        // 校验 create/destroy 后必须有相关消息
        if (this.state.lastCreated) {
          if (obj.to !== this.state.lastCreated.name) {
            throw new Error(
              'The created participant ' +
              this.state.lastCreated.name +
              ' does not have an associated creating message after its declaration. Please check the sequence diagram.',
            );
          } else {
            this.state.lastCreated = undefined;
          }
        } else if (this.state.lastDestroyed) {
          if (
            obj.to !== this.state.lastDestroyed.name &&
            obj.from !== this.state.lastDestroyed.name
          ) {
            throw new Error(
              'The destroyed participant ' +
              this.state.lastDestroyed.name +
              ' does not have an associated destroying message after its declaration. Please check the sequence diagram.',
            );
          } else {
            this.state.lastDestroyed = undefined;
          }
        }
        this.addSignal(
          obj.from as string,
          obj.to as string,
          obj.msg as { text: string; wrap: boolean },
          obj.signalType as number,
          obj.activate as boolean,
          obj.centralConnection as number,
        );
        break;
      }

      case 'boxStart':
        this.addBox(obj.boxData as { text: string; color: string; wrap: boolean });
        break;

      case 'boxEnd':
        this.boxEnd();
        break;

      case 'loopStart':
        this.addSignal(undefined, undefined, obj.loopText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'loopEnd':
        this.addSignal(undefined, undefined, undefined, obj.signalType as number);
        break;

      case 'rectStart':
        this.addSignal(undefined, undefined, obj.color as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'rectEnd':
        this.addSignal(undefined, undefined, undefined, obj.signalType as number);
        break;

      case 'optStart':
        this.addSignal(undefined, undefined, obj.optText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'optEnd':
        this.addSignal(undefined, undefined, undefined, obj.signalType as number);
        break;

      case 'altStart':
        this.addSignal(undefined, undefined, obj.altText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'else':
        this.addSignal(undefined, undefined, obj.altText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'altEnd':
        this.addSignal(undefined, undefined, undefined, obj.signalType as number);
        break;

      case 'setAccTitle':
        this.setAccTitle(obj.text as string);
        break;

      case 'parStart':
        this.addSignal(undefined, undefined, obj.parText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'and':
        this.addSignal(undefined, undefined, obj.parText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'parEnd':
        this.addSignal(undefined, undefined, undefined, obj.signalType as number);
        break;

      case 'criticalStart':
        this.addSignal(undefined, undefined, obj.criticalText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'option':
        this.addSignal(undefined, undefined, obj.optionText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'criticalEnd':
        this.addSignal(undefined, undefined, undefined, obj.signalType as number);
        break;

      case 'breakStart':
        this.addSignal(undefined, undefined, obj.breakText as { text: string; wrap: boolean }, obj.signalType as number);
        break;

      case 'breakEnd':
        this.addSignal(undefined, undefined, undefined, obj.signalType as number);
        break;

      default:
        // 未知类型：忽略（对齐官方行为）
        break;
    }
  }

  // ============================================================
  // getData — 返回 SequenceAST
  // ============================================================

  public getData(): SequenceAST {
    return {
      actors: this.state.actors,
      messages: this.state.messages,
      notes: this.state.notes,
      boxes: this.state.boxes,
      createdActors: this.state.createdActors,
      destroyedActors: this.state.destroyedActors,
      sequenceNumbersEnabled: this.state.sequenceNumbersEnabled,
      accTitle: this.state.accTitle,
      accDescr: this.state.accDescription,
    };
  }
}

// ============================================================
// 工具函数
// ============================================================

function createInitialState(): SequenceState {
  return {
    prevActor: undefined,
    actors: new Map<string, Actor>(),
    createdActors: new Map<string, number>(),
    destroyedActors: new Map<string, number>(),
    boxes: [],
    messages: [],
    notes: [],
    sequenceNumbersEnabled: false,
    wrapEnabled: undefined,
    currentBox: undefined,
    lastCreated: undefined,
    lastDestroyed: undefined,
    accTitle: undefined,
    accDescription: undefined,
    diagramTitle: undefined,
  };
}
