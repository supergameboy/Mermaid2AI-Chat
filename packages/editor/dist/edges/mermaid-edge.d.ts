import { type EdgeProps } from '@xyflow/react';
import type { MermaidEdgeStyle } from '@mermaid2aichat/serializer';
export declare const EDGE_STYLE_MAP: Record<MermaidEdgeStyle, {
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
}>;
export declare const MermaidEdgeComponent: import("react").MemoExoticComponent<({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, }: EdgeProps) => import("react").JSX.Element>;
export declare const edgeTypes: {
    default: import("react").MemoExoticComponent<({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, }: EdgeProps) => import("react").JSX.Element>;
    smoothstep: import("react").MemoExoticComponent<({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, }: EdgeProps) => import("react").JSX.Element>;
    floating: import("react").MemoExoticComponent<({ id, source, target, data, selected, }: EdgeProps) => import("react").JSX.Element | null>;
};
//# sourceMappingURL=mermaid-edge.d.ts.map