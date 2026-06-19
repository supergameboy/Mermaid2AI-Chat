import { type NodeProps, type Node } from '@xyflow/react';
import type { MermaidShapeType, MermaidNodeData } from '@mermaid-editor/serializer';
/** React Flow 节点类型，data 为 MermaidNodeData */
type MermaidFlowNode = Node<MermaidNodeData, MermaidShapeType>;
/** 通用节点组件 — 根据形状渲染不同 SVG 形状 */
export declare const MermaidNodeComponent: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
/** 节点类型注册 — 14种形状 */
export declare const nodeTypes: {
    rect: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    rounded: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    stadium: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    diamond: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    circle: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    cylinder: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    hexagon: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    parallelogram: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    subroutine: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    doublecircle: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    asymmetric: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    'parallelogram-reverse': import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    trapezoid: import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
    'trapezoid-reverse': import("react").MemoExoticComponent<({ data, selected }: NodeProps<MermaidFlowNode>) => import("react").JSX.Element>;
};
export {};
//# sourceMappingURL=mermaid-nodes.d.ts.map