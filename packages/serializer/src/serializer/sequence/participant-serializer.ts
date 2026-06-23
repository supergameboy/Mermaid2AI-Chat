/**
 * sequence 序列化器 — 参与者序列化
 *
 * 单一职责：将 MermaidNode[]（参与者）序列化为 Mermaid participant/actor 代码
 *
 * 输出格式:
 *   - "participant A as Alice\n"
 *   - "actor B\n"
 *   - "boundary C\n"
 *   - "box rgba(255,0,0,0.2) BoxName\n  participant A\n  participant B\nend\n"
 */

import type { MermaidNode, GraphMetadata } from '../../types.js';
import type { SequenceBoxInfo } from './sequence-serializer.js';

/** 参与者类型 → 关键字 */
const PARTICIPANT_KEYWORD: Record<string, string> = {
  'actor': 'actor',
  'participant': 'participant',
  'boundary': 'boundary',
  'collections': 'collections',
  'control': 'control',
  'database': 'database',
  'entity': 'entity',
  'queue': 'queue',
};

/**
 * 序列化参与者
 *
 * @param nodes - 参与者节点列表
 * @param boxes - Box 分组列表
 * @returns 序列化后的代码行数组
 */
export function serializeParticipants(
  nodes: MermaidNode[],
  boxes: SequenceBoxInfo[],
): string[] {
  const lines: string[] = [];

  // 按 box 分组：先输出 box 内的参与者，再输出无 box 的参与者
  const boxedActorKeys = new Set<string>();
  for (const box of boxes) {
    for (const key of box.actorKeys) {
      boxedActorKeys.add(key);
    }
  }

  // 输出 box 分组
  for (const box of boxes) {
    const colorPart = box.color && box.color !== 'transparent' ? ` ${box.color}` : '';
    const namePart = box.name ? ` ${box.name}` : '';
    lines.push(`box${colorPart}${namePart}`);

    for (const actorKey of box.actorKeys) {
      const node = nodes.find((n) => n.id === actorKey);
      if (node) {
        lines.push(`  ${serializeSingleParticipant(node)}`);
      }
    }

    lines.push('end');
    lines.push('');
  }

  // 输出无 box 的参与者
  for (const node of nodes) {
    if (!boxedActorKeys.has(node.id)) {
      lines.push(serializeSingleParticipant(node));
    }
  }

  if (nodes.length > 0) {
    lines.push('');
  }

  return lines;
}

/** 序列化单个参与者 */
function serializeSingleParticipant(node: MermaidNode): string {
  const actorType = readStringField(node.data, 'sequenceActorType') ?? 'participant';
  const keyword = PARTICIPANT_KEYWORD[actorType] ?? 'participant';
  const label = node.data.label;
  const hasAlias = label && label !== node.id;

  if (hasAlias) {
    return `${keyword} ${node.id} as ${label}`;
  }
  return `${keyword} ${node.id}`;
}

/** 安全读取字符串字段 */
function readStringField(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  return typeof v === 'string' ? v : undefined;
}
