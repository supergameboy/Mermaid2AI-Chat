/**
 * 序列化调度器 — 浏览器安全
 *
 * 单一职责：根据 diagramType 分发到对应序列化器
 *
 * 数据流:
 *   serializeMermaid(canvas) → 按 canvas.diagramType 分发 → 各类型序列化器 → SerializeResult
 *
 * 注意: 本文件为浏览器安全入口，不导入任何 Node.js 内置模块。
 * 图表类型检测（detectDiagramType）位于 detector/index.ts，基于官方 detector 注册机制。
 * 解析调度（parseMermaid）位于 parse-dispatcher.ts，同样浏览器安全。
 */

import type {
  CanvasState,
  DiagramType,
  SerializeResult,
} from './types.js';
import { serializeFlowchart } from './serializer/flowchart/index.js';
import { serializeSequence } from './serializer/sequence/index.js';
import { serializeClass } from './serializer/class/class-serializer.js';
import { serializeER } from './serializer/er/er-serializer.js';
import { serializeState } from './serializer/state-serializer.js';
import { serializeMindmap } from './serializer/mindmap-serializer.js';
import { serializeArchitecture } from './serializer/architecture-serializer.js';
import { serializeGantt } from './serializer/gantt-serializer.js';
import { serializeTimeline } from './serializer/timeline-serializer.js';
import { serializeQuadrant } from './serializer/quadrant-serializer.js';
import { serializePie } from './serializer/pie-serializer.js';
import { serializeXYChart } from './serializer/xychart-serializer.js';

// detectDiagramType 从 detector 模块重新导出（保持向后兼容）
export { detectDiagramType } from './detector/index.js';

// ============================================================
// 序列化调度
// ============================================================

/**
 * 序列化 CanvasState 为 Mermaid 代码
 *
 * @param canvas - CanvasState（任意图表类型）
 * @returns 序列化结果（包含 mermaid 代码和错误列表）
 */
export function serializeMermaid(canvas: CanvasState): SerializeResult {
  switch (canvas.diagramType) {
    case 'flowchart':
      return serializeFlowchart(canvas);
    case 'sequenceDiagram':
      return serializeSequence(canvas);
    case 'classDiagram':
      return serializeClass(canvas);
    case 'erDiagram':
      return serializeER(canvas);
    case 'stateDiagram':
      return serializeState(canvas);
    case 'mindmap':
      return serializeMindmap(canvas);
    case 'architecture':
      return serializeArchitecture(canvas);
    case 'gantt':
      return serializeGantt(canvas);
    case 'pie':
      return serializePie(canvas);
    case 'timeline':
      return serializeTimeline(canvas);
    case 'quadrantChart':
      return serializeQuadrant(canvas);
    case 'xychart':
      return serializeXYChart(canvas);
  }
}
