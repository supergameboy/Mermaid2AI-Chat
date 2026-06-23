/**
 * Sequence 专用 AST 层类型定义
 *
 * 单一职责：定义 SequenceDB 内部使用的 Actor/Message/Note/Box/AddMessageParams 类型
 * 来源：移植自官方 mermaid packages/mermaid/src/diagrams/sequence/types.ts
 *
 * 注意：
 * - 核心类型（SequenceArrowType / SequenceBlockType / SequenceParticipantInfo / SequenceBlockInfo / SequenceNoteInfo）
 *   已在 M0 `packages/serializer/src/types.ts` 中统一定义，本文件不重新定义
 * - 本文件仅定义 sequence 解析器内部使用的 AST 层数据结构
 */

/** Sequence Box（参与者分组） */
export interface Box {
  name: string;
  wrap: boolean;
  fill: string;
  actorKeys: string[];
}

/** Sequence Actor（参与者） */
export interface Actor {
  box?: Box;
  name: string;
  description: string;
  wrap: boolean;
  prevActor?: string;
  nextActor?: string;
  links: Record<string, unknown>;
  properties: Record<string, unknown>;
  actorCnt: number | null;
  rectData: unknown;
  type: string;
}

/** Sequence Message（消息/信号） */
export interface Message {
  id: number;
  from?: string;
  to?: string;
  message: string | { start: number; step: number; visible: boolean };
  wrap: boolean;
  answer?: unknown;
  type?: number;
  activate?: boolean;
  placement?: string;
  centralConnection?: number;
}

/** Sequence addMessage 参数 */
export interface AddMessageParams {
  from: string;
  to: string;
  msg: string;
  signalType: number;
  type: string;
  activate: boolean;
}

/** Sequence Note（注释） */
export interface Note {
  actor: { actor: string };
  placement: Message['placement'];
  message: string;
  wrap: boolean;
}
