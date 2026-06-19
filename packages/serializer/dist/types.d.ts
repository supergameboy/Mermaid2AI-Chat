/**
 * 核心类型定义 — 所有包共享的数据模型
 * 单一数据源：其他包通过 import 引用，禁止重新定义
 */
export type MermaidShapeType = 'rect' | 'rounded' | 'stadium' | 'diamond' | 'circle' | 'cylinder' | 'hexagon' | 'parallelogram' | 'subroutine' | 'doublecircle' | 'asymmetric' | 'parallelogram-reverse' | 'trapezoid' | 'trapezoid-reverse';
export type MermaidEdgeStyle = 'arrow' | 'line' | 'dotted' | 'dotted-arrow' | 'thick' | 'circle' | 'cross' | 'bidirectional';
export type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';
export interface NodeStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    color?: string;
}
export interface EdgeMarker {
    type: 'arrow' | 'arrowclosed';
    width?: number;
    height?: number;
    color?: string;
}
export interface MermaidNodeData {
    label: string;
    shape: MermaidShapeType;
    style?: NodeStyle;
    [key: string]: unknown;
}
export interface MermaidEdgeData {
    edgeStyle: MermaidEdgeStyle;
    label?: string;
    [key: string]: unknown;
}
export interface MermaidNode {
    id: string;
    type: MermaidShapeType;
    position: {
        x: number;
        y: number;
    };
    data: MermaidNodeData;
    parentId?: string;
    extent?: 'parent' | [[number, number], [number, number]];
    selected?: boolean;
    dragging?: boolean;
    width?: number;
    height?: number;
    zIndex?: number;
}
export interface MermaidEdge {
    id: string;
    source: string;
    target: string;
    type?: string;
    data: MermaidEdgeData;
    markerStart?: EdgeMarker;
    markerEnd?: EdgeMarker;
    selected?: boolean;
    animated?: boolean;
    zIndex?: number;
}
export interface CanvasState {
    nodes: MermaidNode[];
    edges: MermaidEdge[];
    direction: FlowchartDirection;
}
export type CanvasSource = 'user' | 'ai' | null;
export interface ConsumedState {
    consumed: boolean;
    lastConsumedAt: number | null;
    canvasSource: CanvasSource;
}
export interface ParseSuccessResult {
    success: true;
    canvas: CanvasState;
    errors: ParseError[];
}
export interface ParseFailureResult {
    success: false;
    canvas: CanvasState;
    errors: ParseError[];
}
export type ParseResult = ParseSuccessResult | ParseFailureResult;
export interface ParseError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
    context?: string;
}
export interface SerializeResult {
    mermaid: string;
    errors: ParseError[];
}
//# sourceMappingURL=types.d.ts.map