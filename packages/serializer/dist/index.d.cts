/**
 * 核心类型定义 — 所有包共享的数据模型
 * 单一数据源：其他包通过 import 引用，禁止重新定义
 */
type MermaidShapeType = 'rect' | 'rounded' | 'stadium' | 'diamond' | 'circle' | 'cylinder' | 'hexagon' | 'parallelogram' | 'subroutine' | 'doublecircle' | 'asymmetric' | 'parallelogram-reverse' | 'trapezoid' | 'trapezoid-reverse';
type MermaidEdgeStyle = 'arrow' | 'line' | 'dotted' | 'dotted-arrow' | 'thick' | 'circle' | 'cross' | 'bidirectional';
type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';
interface NodeStyle {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    color?: string;
}
interface EdgeMarker {
    type: 'arrow' | 'arrowclosed';
    width?: number;
    height?: number;
    color?: string;
}
interface MermaidNodeData {
    label: string;
    shape: MermaidShapeType;
    style?: NodeStyle;
    [key: string]: unknown;
}
interface MermaidEdgeData {
    edgeStyle: MermaidEdgeStyle;
    label?: string;
    [key: string]: unknown;
}
interface MermaidNode {
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
interface MermaidEdge {
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
interface Viewport {
    x: number;
    y: number;
    zoom: number;
}
interface CanvasState {
    nodes: MermaidNode[];
    edges: MermaidEdge[];
    direction: FlowchartDirection;
}
type CanvasSource = 'user' | 'ai' | null;
interface ConsumedState {
    consumed: boolean;
    lastConsumedAt: number | null;
    canvasSource: CanvasSource;
}
interface ParseSuccessResult {
    success: true;
    canvas: CanvasState;
    errors: ParseError[];
}
interface ParseFailureResult {
    success: false;
    canvas: CanvasState;
    errors: ParseError[];
}
type ParseResult = ParseSuccessResult | ParseFailureResult;
interface ParseError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
    context?: string;
}
interface SerializeResult {
    mermaid: string;
    errors: ParseError[];
}

/**
 * 错误收集器 — 解析错误收集、定位、反馈
 * 宽容模式：收集错误但不中断解析
 */
declare class ErrorCollector {
    private errors;
    add(error: ParseError): void;
    addError(line: number, column: number, message: string, context?: string): void;
    addWarning(line: number, column: number, message: string, context?: string): void;
    getErrors(): ParseError[];
    hasErrors(): boolean;
    hasWarnings(): boolean;
    clear(): void;
    getSummary(): {
        errors: number;
        warnings: number;
        total: number;
    };
}

/**
 * 解析 Mermaid 代码为画布状态
 * 宽容模式：即使有错误也返回部分结果
 */
declare function parseMermaid(source: string, errorCollector?: ErrorCollector): ParseResult;

/**
 * 序列化器 — CanvasState → Mermaid 代码
 * 自定义序列化器，完全可控，输出格式精确
 */

/**
 * 将画布状态序列化为 Mermaid 代码
 */
declare function serializeMermaid(canvas: CanvasState): SerializeResult;

/**
 * 节点序列化器 — 画布节点 → mermaid 节点语法
 */
declare function serializeNode(node: MermaidNode): string;
/**
 * 获取节点形状的语法配置
 */
declare function getShapeSyntax(shape: MermaidShapeType): {
    open: string;
    close: string;
};
/**
 * 反转义标签
 */
declare function unescapeLabel(label: string): string;

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
declare function serializeEdge(edge: MermaidEdge): string;
/**
 * 获取边样式的语法配置
 */
declare function getEdgeSyntax(style: MermaidEdgeStyle): {
    line: string;
    startMarker: string;
    endMarker: string;
};

/**
 * ID 生成器 — 自动短 ID（A, B, C... Z, AA, AB...）
 * 双射 26 进制算法，保证唯一性
 */
declare class IdGenerator {
    private counter;
    private usedIds;
    /**
     * 生成下一个短 ID
     */
    next(): string;
    /**
     * 预注册已存在的 ID（解析时保留原始 ID）
     */
    register(id: string): void;
    /**
     * 重置生成器
     */
    reset(): void;
    /**
     * 26 进制编码（A=0, B=1, ... Z=25, AA=26, AB=27...）
     */
    private encode;
}
/** 全局默认实例 */
declare const idGenerator: IdGenerator;

export { type CanvasSource, type CanvasState, type ConsumedState, type EdgeMarker, ErrorCollector, type FlowchartDirection, IdGenerator, type MermaidEdge, type MermaidEdgeData, type MermaidEdgeStyle, type MermaidNode, type MermaidNodeData, type MermaidShapeType, type NodeStyle, type ParseError, type ParseFailureResult, type ParseResult, type ParseSuccessResult, type SerializeResult, type Viewport, getEdgeSyntax, getShapeSyntax, idGenerator, parseMermaid, serializeEdge, serializeMermaid, serializeNode, unescapeLabel };
