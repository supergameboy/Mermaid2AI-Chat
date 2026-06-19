import type { MermaidNode, MermaidShapeType } from './types.js';
/**
 * 节点序列化器 — 画布节点 → mermaid 节点语法
 */
export declare function serializeNode(node: MermaidNode): string;
/**
 * 获取节点形状的语法配置
 */
export declare function getShapeSyntax(shape: MermaidShapeType): {
    open: string;
    close: string;
};
/**
 * 反转义标签
 */
export declare function unescapeLabel(label: string): string;
//# sourceMappingURL=node-serializer.d.ts.map