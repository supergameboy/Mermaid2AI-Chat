import type { MermaidEdge, MermaidEdgeStyle } from './types.js';
/**
 * 边序列化器 — 画布边 → mermaid 边语法
 *
 * 示例:
 *   arrow:         A --> B
 *   line:          A --- B
 *   dotted:        A -.- B
 *   dotted-arrow:  A -.-> B
 *   thick:         A ==> B
 *   circle:        A ---o B
 *   cross:         A ---x B
 *   bidirectional: A <---> B
 *   带标签:        A -->|标签| B
 */
export declare function serializeEdge(edge: MermaidEdge): string;
/**
 * 获取边样式的语法配置
 */
export declare function getEdgeSyntax(style: MermaidEdgeStyle): {
    line: string;
    startMarker: string;
    endMarker: string;
};
//# sourceMappingURL=edge-serializer.d.ts.map