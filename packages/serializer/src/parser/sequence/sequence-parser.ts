/**
 * sequence 解析器
 *
 * 单一职责：将 Mermaid sequenceDiagram 代码解析为 CanvasState (GraphCanvasState)
 *
 * 数据流:
 *   源代码字符串
 *     → 加载 jison 生成的 sequence-parser.cjs
 *     → 创建 SequenceDB 实例，作为 yy 传入 parser
 *     → parser.parse(source) 调用 SequenceDB.apply/parseMessage/... 收集数据
 *     → SequenceDB.getData() 返回 SequenceAST
 *     → mapAstToCanvasState(ast) 映射为 CanvasState
 *
 * 错误处理:
 *   - jison 抛出的语法错误被捕获，转换为 ParseError[]
 *   - 解析成功时 errors 为空数组
 */

import { parser as sequenceParser } from '../jison/sequence-parser.js';
import { preprocessCode } from '../../detector/preprocessor.js';
import type {
  CanvasState,
  GraphCanvasState,
  MermaidNode,
  MermaidEdge,
  MermaidNodeData,
  MermaidEdgeData,
  MermaidShapeType,
  MermaidEdgeStyle,
  SequenceArrowType,
  SequenceBlockType,
  SequenceParticipantInfo,
  SequenceBlockInfo,
  SequenceNoteInfo,
  GraphMetadata,
  ParseError,
} from '../../types.js';
import type { SequenceAST } from '../../ast/sequence-ast.js';
import type { Actor, Box, Message } from './types.js';
import { SequenceDB } from './sequence-db.js';
import {
  LINETYPE,
  PLACEMENT,
  LINETYPE_TO_ARROW_TYPE,
  LINETYPE_TO_BLOCK_TYPE,
  PARTICIPANT_TYPE,
} from './constants.js';

// ============================================================
// jison parser（静态 import，浏览器兼容）
// ============================================================

interface JisonParserInstance {
  parse(input: string): unknown;
  yy: unknown;
}

/** sequence jison 解析器实例 */
const sequenceJisonParser: JisonParserInstance = sequenceParser as unknown as JisonParserInstance;

// ============================================================
// 解析结果类型
// ============================================================

/** sequence 解析结果 */
export interface SequenceParseResult {
  /** 是否解析成功（无语法错误） */
  success: boolean;
  /** 解析后的 CanvasState（失败时返回空状态） */
  canvas: GraphCanvasState;
  /** 解析错误列表 */
  errors: ParseError[];
}

// ============================================================
// AST → CanvasState 映射
// ============================================================

/** Sequence Box 信息（写入 metadata.sequenceBoxes 扩展字段） */
interface SequenceBoxInfo {
  id: string;
  name: string;
  color: string;
  actorKeys: string[];
}

/**
 * 将 SequenceAST 映射为 CanvasState (GraphCanvasState with diagramType='sequenceDiagram')
 *
 * 映射规则:
 *   - actors → nodes（参与者，shape='rect'，type='sequence-participant'）
 *   - messages（普通消息）→ edges（含 messageType/sequence/activate）
 *   - messages（块标记）→ metadata.blocks（SequenceBlockInfo[]）
 *   - notes → metadata.notes（SequenceNoteInfo[]）
 *   - boxes → metadata.sequenceBoxes（SequenceBoxInfo[]）
 *   - createdActors/destroyedActors → metadata 扩展字段
 *   - sequenceNumbersEnabled → metadata.autonumber
 */
function mapAstToCanvasState(ast: SequenceAST): GraphCanvasState {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const participants: SequenceParticipantInfo[] = [];
  const blocks: SequenceBlockInfo[] = [];
  const notes: SequenceNoteInfo[] = [];
  const sequenceBoxes: SequenceBoxInfo[] = [];

  // ============================================================
  // 1. 映射 actors → nodes + participants
  // ============================================================
  let actorIndex = 0;
  for (const [actorId, actor] of ast.actors) {
    const shape: MermaidShapeType = 'rect';
    const data: MermaidNodeData = {
      label: actor.description || actor.name,
      shape,
      participantType: actor.type === PARTICIPANT_TYPE.ACTOR ? 'actor' : 'participant',
      // sequence 专用扩展字段（通过索引签名承载）
      sequenceActorType: actor.type,
      sequenceActorWrap: actor.wrap,
      ...(actor.box ? { sequenceBoxName: actor.box.name } : {}),
      ...(Object.keys(actor.links).length > 0 ? { sequenceLinks: actor.links } : {}),
      ...(Object.keys(actor.properties).length > 0 ? { sequenceProperties: actor.properties } : {}),
    };

    nodes.push({
      id: actorId,
      type: 'sequence-participant',
      position: { x: actorIndex * 200, y: 0 },
      data,
    });

    participants.push({
      id: actorId,
      label: actor.description || actor.name,
      participantType: actor.type === PARTICIPANT_TYPE.ACTOR ? 'actor' : 'participant',
    });

    actorIndex++;
  }

  // ============================================================
  // 2. 映射 boxes → sequenceBoxes
  // ============================================================
  let boxIndex = 0;
  for (const box of ast.boxes) {
    const boxId = `box-${boxIndex}`;
    sequenceBoxes.push({
      id: boxId,
      name: box.name,
      color: box.fill,
      actorKeys: [...box.actorKeys],
    });
    boxIndex++;
  }

  // ============================================================
  // 3. 遍历 messages，分发到 edges / blocks / notes
  // ============================================================
  const blockStack: { type: SequenceBlockType; label?: string; startMessage: number }[] = [];

  let messageSequence = 0;
  let lastEdgeIndex: number | undefined; // 跟踪最近创建的 edge 索引，用于关联 deactivate 信号
  let autonumberEnabled = false;

  for (let i = 0; i < ast.messages.length; i++) {
    const msg = ast.messages[i];
    const linetype = msg.type;

    // 跳过 sequenceIndex（autonumber 配置消息），但检测 visible=true
    if (linetype === LINETYPE.AUTONUMBER) {
      // sequenceIndex 消息的 message 字段是 { start, step, visible }
      if (typeof msg.message === 'object' && msg.message !== null) {
        const visible = (msg.message as { visible?: boolean }).visible;
        if (visible) {
          autonumberEnabled = true;
        } else {
          autonumberEnabled = false;
        }
      }
      continue;
    }

    // Note 消息（LINETYPE.NOTE）
    if (linetype === LINETYPE.NOTE) {
      const noteActor = typeof msg.from === 'string' ? msg.from : '';
      // PLACEMENT 是数值常量（LEFTOF=0, RIGHTOF=1, OVER=2）
      const placementNum: number = typeof msg.placement === 'number' ? msg.placement : PLACEMENT.OVER;
      const position: 'left' | 'right' | 'over' =
        placementNum === PLACEMENT.LEFTOF ? 'left' :
        placementNum === PLACEMENT.RIGHTOF ? 'right' :
        'over';
      const noteMessage = typeof msg.message === 'string' ? msg.message : '';

      notes.push({
        participantId: noteActor,
        position,
        label: noteMessage,
        // messageIndex 对齐 edge 的 sequence 字段，便于序列化时按顺序输出
        messageIndex: messageSequence,
      });
      continue;
    }

    // 块结构消息（linetype 必须存在才判断）
    if (linetype !== undefined) {
      const blockTypeStr = LINETYPE_TO_BLOCK_TYPE[linetype];
      if (blockTypeStr) {
        const blockType = blockTypeStr as SequenceBlockType;
        const blockLabel = typeof msg.message === 'string' ? msg.message : undefined;

        if (isBlockStart(linetype)) {
          blockStack.push({
            type: blockType,
            label: blockLabel,
            startMessage: messageSequence,
          });
        } else if (isBlockEnd(linetype)) {
          const started = blockStack.pop();
          if (started) {
            blocks.push({
              type: started.type,
              label: started.label,
              startMessage: started.startMessage,
              endMessage: messageSequence,
            });
          }
        } else if (isBlockMid(linetype)) {
          // alt/par/critical 的中间分支（else/and/option）
          // 关闭当前块，开启新分支
          const started = blockStack.pop();
          if (started) {
            blocks.push({
              type: started.type,
              label: started.label,
              startMessage: started.startMessage,
              endMessage: messageSequence,
            });
          }
          blockStack.push({
            type: blockType,
            label: blockLabel,
            startMessage: messageSequence,
          });
        }
        continue;
      }

      // 激活信号
      if (linetype === LINETYPE.ACTIVE_START) {
        // activate 语句：不生成独立 edge，由渲染层处理
        continue;
      }
      if (linetype === LINETYPE.ACTIVE_END) {
        // deactivate 信号：标记最近一条 edge 为 deactivate=true
        // 对应 mermaid 语法中的 `-` 后缀（deactivate source）
        if (lastEdgeIndex !== undefined && edges[lastEdgeIndex]) {
          const edge = edges[lastEdgeIndex];
          (edge.data as MermaidEdgeData).deactivate = true;
        }
        continue;
      }
    }

    // 普通消息 → edge
    if (msg.from && msg.to && linetype !== undefined) {
      const arrowTypeStr = LINETYPE_TO_ARROW_TYPE[linetype];
      const arrowType = (arrowTypeStr ?? 'solid-arrow') as SequenceArrowType;
      const edgeStyle = mapArrowTypeToEdgeStyle(arrowType);
      const messageText = typeof msg.message === 'string' ? msg.message : '';

      const data: MermaidEdgeData = {
        edgeStyle,
        label: messageText,
        messageType: arrowType,
        sequence: messageSequence,
        ...(msg.activate ? { activate: true } : {}),
        ...(msg.centralConnection ? { centralConnection: msg.centralConnection } : {}),
      };

      const edgeId = `seq-edge-${i}`;
      edges.push({
        id: edgeId,
        source: msg.from,
        target: msg.to,
        type: 'sequence-message',
        data,
      });
      lastEdgeIndex = edges.length - 1;
    }

    messageSequence++;
  }

  // 关闭未闭合的块
  while (blockStack.length > 0) {
    const started = blockStack.pop();
    if (started) {
      blocks.push({
        type: started.type,
        label: started.label,
        startMessage: started.startMessage,
        endMessage: messageSequence,
      });
    }
  }

  // ============================================================
  // 4. 构建 metadata
  // ============================================================
  const metadata: GraphMetadata = {
    participants,
    blocks,
    notes,
    // autonumber 由 sequenceIndex 消息的 visible 字段决定
    autonumber: autonumberEnabled,
    // sequence 专用扩展字段（通过索引签名承载）
    sequenceBoxes,
    createdActors: Object.fromEntries(ast.createdActors),
    destroyedActors: Object.fromEntries(ast.destroyedActors),
    ...(ast.accTitle ? { accTitle: ast.accTitle } : {}),
    ...(ast.accDescr ? { accDescription: ast.accDescr } : {}),
  };

  return {
    diagramType: 'sequenceDiagram',
    nodes,
    edges,
    metadata,
  };
}

/** 判断 LINETYPE 是否为块开始 */
function isBlockStart(linetype: number): boolean {
  return linetype === LINETYPE.LOOP_START ||
    linetype === LINETYPE.ALT_START ||
    linetype === LINETYPE.OPT_START ||
    linetype === LINETYPE.PAR_START ||
    linetype === LINETYPE.PAR_OVER_START ||
    linetype === LINETYPE.CRITICAL_START ||
    linetype === LINETYPE.BREAK_START ||
    linetype === LINETYPE.RECT_START;
}

/** 判断 LINETYPE 是否为块结束 */
function isBlockEnd(linetype: number): boolean {
  return linetype === LINETYPE.LOOP_END ||
    linetype === LINETYPE.ALT_END ||
    linetype === LINETYPE.OPT_END ||
    linetype === LINETYPE.PAR_END ||
    linetype === LINETYPE.CRITICAL_END ||
    linetype === LINETYPE.BREAK_END ||
    linetype === LINETYPE.RECT_END;
}

/** 判断 LINETYPE 是否为块中间分支（else/and/option） */
function isBlockMid(linetype: number): boolean {
  return linetype === LINETYPE.ALT_ELSE ||
    linetype === LINETYPE.PAR_AND ||
    linetype === LINETYPE.CRITICAL_OPTION;
}

/**
 * 将 SequenceArrowType 映射为 MermaidEdgeStyle
 * sequence 的边样式简化为 arrow/dotted-arrow 两类（实际箭头细由 messageType 区分）
 */
function mapArrowTypeToEdgeStyle(arrowType: SequenceArrowType): MermaidEdgeStyle {
  if (arrowType.startsWith('dotted') || arrowType.includes('-dotted')) {
    return 'dotted-arrow';
  }
  if (arrowType.startsWith('bidirectional-dotted')) {
    return 'dotted-arrow';
  }
  if (arrowType.startsWith('bidirectional')) {
    return 'bidirectional-arrow';
  }
  return 'arrow';
}

// ============================================================
// 公共 API
// ============================================================

/**
 * 解析 sequenceDiagram 代码为 CanvasState
 *
 * 预处理（架构修复）:
 *   - 内部调用 preprocessCode 清理 frontmatter/指令/注释（保持行号一致）
 *   - jison 解析清理后的 code，错误上下文使用原始 source
 *
 * @param source - Mermaid sequenceDiagram 源代码（可含 %% 注释、%%{directive}%%、frontmatter）
 * @returns 解析结果（包含 canvas 和 errors）
 */
export function parseSequence(source: string): SequenceParseResult {
  const parser = sequenceJisonParser;
  const sequenceDB = new SequenceDB();

  // 将 SequenceDB 实例作为 yy 传入 parser
  // jison 语法动作通过 yy.apply/yy.parseMessage/... 调用 SequenceDB 方法
  parser.yy = sequenceDB;

  try {
    // 预处理：清理 frontmatter/指令/注释（替换为等长换行，保持行号一致）
    // jison 无法解析 %% 注释和 %%{directive}%%，必须预处理
    const preprocessedSource = preprocessCode(source);
    // jison 语法要求 sequenceDiagram 后必须有 NEWLINE
    const normalizedSource = preprocessedSource.endsWith('\n') ? preprocessedSource : preprocessedSource + '\n';
    parser.parse(normalizedSource);

    const ast = sequenceDB.getData();
    const canvas = mapAstToCanvasState(ast);

    return {
      success: true,
      canvas,
      errors: [],
    };
  } catch (err) {
    const error: ParseError = {
      line: extractLine(err),
      column: extractColumn(err),
      message: extractMessage(err),
      severity: 'error',
      context: source.split('\n')[extractLine(err) - 1] ?? undefined,
    };

    // 返回空 canvas + 错误列表
    const emptyCanvas: GraphCanvasState = {
      diagramType: 'sequenceDiagram',
      nodes: [],
      edges: [],
    };

    return {
      success: false,
      canvas: emptyCanvas,
      errors: [error],
    };
  } finally {
    // 重置 parser.yy，避免泄漏
    parser.yy = {};
  }
}

// ============================================================
// 错误信息提取
// ============================================================

function extractLine(err: unknown): number {
  if (err && typeof err === 'object') {
    const line = (err as { line?: unknown }).line;
    if (typeof line === 'number') return line;
    const hash = (err as { hash?: { line?: unknown } }).hash;
    if (hash && typeof hash.line === 'number') return hash.line;
  }
  return 1;
}

function extractColumn(err: unknown): number {
  if (err && typeof err === 'object') {
    const column = (err as { column?: unknown }).column;
    if (typeof column === 'number') return column;
    const hash = (err as { hash?: { column?: unknown } }).hash;
    if (hash && typeof hash.column === 'number') return hash.column;
  }
  return 1;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || 'sequence parse error';
  }
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'sequence parse error';
}
