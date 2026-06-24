/**
 * 完整类型系统 — 对齐官方 mermaid v11 标准
 * 单一数据源：所有包通过 import 引用，禁止重新定义
 */

// ============================================================
// 1. 节点形状类型（对齐官方 shapes.ts，70+ 种）
// ============================================================

/**
 * Mermaid 节点形状类型
 * - flowchart 标准形状（16 种 jison 语法）
 * - flowchart 扩展形状（通过 @{shape: xxx} 元数据）
 * - 各图表类型专用形状
 */
export type MermaidShapeType =
  // === flowchart jison 语法形状（16 种）===
  | 'rect'                    // id[文本] 标准矩形
  | 'rounded'                 // id(文本) 圆角矩形
  | 'stadium'                 // id([文本]) 体育场形
  | 'ellipse'                 // id(-文本-) 椭圆
  | 'subroutine'              // id[[文本]] 子程序
  | 'cylinder'                // id[(文本)] 圆柱体
  | 'circle'                  // id((文本)) 圆形
  | 'doublecircle'            // id(((文本))) 双圆
  | 'diamond'                 // id{文本} 菱形
  | 'hexagon'                 // id{{文本}} 六边形
  | 'odd'                     // id>文本] 奇形
  | 'trapezoid'               // id[/文本/] 梯形
  | 'trapezoid-reverse'       // id[\文本\] 倒梯形
  | 'lean-right'              // id[/文本\] 右倾斜
  | 'lean-left'               // id[\文本/] 左倾斜
  | 'rect-with-prop'          // id[|field:value|文本] 带属性矩形
  // === flowchart 扩展形状（shapeData，31 种常用）===
  | 'datastore'               // 数据存储
  | 'document'                // 文档
  | 'note'                    // 便签
  | 'triangle'                // 三角形
  | 'fork-join'               // Fork/Join
  | 'hourglass'               // 沙漏
  | 'lightning-bolt'          // 闪电
  | 'cloud'                   // 云形
  | 'bang'                    // 爆炸形
  | 'text'                    // 文本块
  | 'card'                    // 卡片
  | 'lined-rectangle'         // 带线矩形
  | 'small-circle'            // 小起点圆
  | 'framed-circle'           // 带框圆（停止点）
  | 'brace-left'              // 左花括号
  | 'brace-right'             // 右花括号
  | 'braces'                  // 双花括号
  | 'delay'                   // 延迟（半圆角矩形）
  | 'horizontal-cylinder'     // 水平圆柱
  | 'lined-cylinder'          // 带线圆柱（磁盘）
  | 'curved-trapezoid'        // 曲边梯形（显示器）
  | 'divided-rectangle'       // 分割矩形
  | 'window-pane'             // 窗格（内部存储）
  | 'filled-circle'           // 实心圆（连接点）
  | 'notched-pentagon'        // 凹五边形（循环限制）
  | 'flipped-triangle'        // 倒三角
  | 'sloped-rectangle'        // 斜矩形（手动输入）
  | 'stacked-document'        // 堆叠文档
  | 'stacked-rectangle'       // 堆叠矩形
  | 'bow-tie-rectangle'       // 蝴蝶结矩形
  | 'crossed-circle'          // 交叉圆
  | 'tagged-document'         // 标签文档
  | 'tagged-rectangle'        // 标签矩形
  | 'flag'                    // 旗帜（纸带）
  | 'lined-document'          // 带线文档
  // === state 专用形状（8 种）===
  | 'state-default'           // 默认状态
  | 'state-with-desc'         // 带描述状态
  | 'state-start'             // 起始状态（小圆）
  | 'state-end'               // 结束状态（带框圆）
  | 'state-divider'           // 分隔线
  | 'state-group'             // 状态组
  | 'state-note'              // 便签
  | 'state-note-group'        // 便签组
  // === class/er 专用形状（2 种）===
  | 'class-box'               // 类图盒子
  | 'er-box'                  // ER 图盒子
  // === mindmap 专用形状（7 种）===
  | 'mindmap-default'         // 默认（无边界）
  | 'mindmap-rounded'         // 圆角矩形
  | 'mindmap-rect'            // 矩形
  | 'mindmap-circle'          // 圆形
  | 'mindmap-cloud'           // 云形
  | 'mindmap-bang'            // 爆炸形
  | 'mindmap-hexagon'         // 六边形
  // === architecture 专用形状（3 种）===
  | 'arch-service'            // 架构服务
  | 'arch-junction'           // 架构连接点
  | 'arch-group'              // 架构分组
  // === sequence 专用形状（2 种）===
  | 'seq-participant'         // 参与者
  | 'seq-actor'               // 演员
  // === 内部未文档化形状（按需扩展）===
  | 'composite'               // 复合形状
  | 'label-rect'              // 标签矩形
  | 'block-arrow'             // 块箭头
  | 'icon-square'             // 方形图标
  | 'icon-circle'             // 圆形图标
  | 'icon'                    // 图标
  | 'icon-rounded'            // 圆角图标
  | 'image-square'            // 方形图片
  | 'anchor'                  // 锚点
  | 'kanban-item'             // 看板项
  | 'requirement-box';        // 需求图盒子

// ============================================================
// 2. 边样式类型（对齐官方 flow.jison，16 种）
// ============================================================

/**
 * Mermaid 边样式
 * 线型（4 种）× 箭头头类型（4 种）的组合 + 双端箭头 + 不可见线
 */
export type MermaidEdgeStyle =
  // === 单端箭头（线型 × 箭头头）===
  | 'line'              // --- 普通实线无箭头
  | 'arrow'             // --> 实线带箭头
  | 'cross'             // --x 实线带十字
  | 'circle'            // --o 实线带圆圈
  | 'thick-line'        // === 粗实线无箭头
  | 'thick-arrow'       // ==> 粗实线带箭头
  | 'thick-cross'       // ==x 粗实线带十字
  | 'thick-circle'      // ==o 粗实线带圆圈
  | 'dotted'            // -.- 点线无箭头
  | 'dotted-arrow'      // -.-> 点线带箭头
  | 'dotted-cross'      // -.x 点线带十字
  | 'dotted-circle'     // -.o 点线带圆圈
  // === 双端箭头 ===
  | 'bidirectional-arrow'   // <--> 双向箭头
  | 'bidirectional-cross'   // x--x 双向十字
  | 'bidirectional-circle'  // o--o 双向圆圈
  // === 特殊 ===
  | 'invisible';            // ~~~ 不可见线（仅布局占位）

// ============================================================
// 3. Sequence 箭头类型（对齐官方 sequenceDiagram.jison，26+ 种）
// ============================================================

/**
 * Sequence Diagram 箭头类型
 * 线型（solid/dashed）× 箭头头类型（filled/open/cross/point/async）的组合
 */
export type SequenceArrowType =
  // === 基本箭头（8 种）===
  | 'solid-arrow'           // ->> 实线实心三角
  | 'dotted-arrow'          // -->> 点线实心三角
  | 'solid-open'            // -> 实线开放
  | 'dotted-open'           // --> 点线开放
  | 'solid-cross'           // -x 实线十字
  | 'dotted-cross'          // --x 点线十字
  | 'solid-point'           // -) 实线圆点
  | 'dotted-point'          // --) 点线圆点
  // === 双向箭头（2 种）===
  | 'bidirectional-solid'   // <<->> 双向实线实心
  | 'bidirectional-dotted'  // <<-->> 双向点线实心
  // === 异步箭头实线（4 种）===
  | 'solid-top'             // -|\ 实线顶部
  | 'solid-bottom'          // -|/ 实线底部
  | 'stick-top'             // -\\ 实线顶部细线
  | 'stick-bottom'          // -/\ 实线底部细线
  // === 异步箭头点线（4 种）===
  | 'solid-top-dotted'      // --|\ 点线顶部
  | 'solid-bottom-dotted'   // --|/ 点线底部
  | 'stick-top-dotted'      // --\\ 点线顶部细线
  | 'stick-bottom-dotted'   // --/\ 点线底部细线
  // === 反向异步箭头实线（4 种）===
  | 'solid-arrow-top-reverse'    // /|- 反向顶部实心
  | 'solid-arrow-bottom-reverse' // \|- 反向底部实心
  | 'stick-arrow-top-reverse'    // /\- 反向顶部细线
  | 'stick-arrow-bottom-reverse' // \\- 反向底部细线
  // === 反向异步箭头点线（4 种）===
  | 'solid-arrow-top-reverse-dotted'    // /|-- 反向顶部实心点线
  | 'solid-arrow-bottom-reverse-dotted' // \|-- 反向底部实心点线
  | 'stick-arrow-top-reverse-dotted'    // /\-- 反向顶部细线点线
  | 'stick-arrow-bottom-reverse-dotted' // \\-- 反向底部细线点线
  // === 中心连接（3 种）===
  | 'central-connection'          // 中心连接
  | 'central-connection-reverse'  // 中心反向连接
  | 'central-connection-dual';    // 中心双向连接

// ============================================================
// 4. Sequence 块类型（alt/opt/loop 等）
// ============================================================

export type SequenceBlockType =
  | 'alt'
  | 'opt'
  | 'loop'
  | 'par'
  | 'par-over'
  | 'critical'
  | 'break'
  | 'rect'
  | 'autonumber';

// ============================================================
// 5. Class Diagram 关系类型（对齐官方 classDiagram.jison）
// ============================================================

/**
 * Class Diagram 关系类型
 */
export type ClassRelationType =
  | 'aggregation'    // o-- 空心菱形（聚合）
  | 'extension'      // <|-- 空心三角箭头（继承）
  | 'composition'    // *-- 实心菱形（组合）
  | 'association'    // --> 开放箭头（关联）
  | 'dependency'     // <.. 开放箭头虚线（依赖）
  | 'realization'    // <|.. 空心三角箭头虚线（实现）
  | 'lollipop';      // --o 棒棒糖（接口实现）

/** Class Diagram 线型 */
export type ClassLineType = 'line' | 'dotted';

/** Class Diagram 成员可见性 */
export type ClassVisibility = '+' | '-' | '#' | '~' | '';

/** Class Diagram 成员分类符 */
export type ClassClassifier = '*' | '$' | '';

// ============================================================
// 6. ER Diagram 基数类型（对齐官方 erDiagram.jison）
// ============================================================

/**
 * ER Diagram 基数类型
 *
 * 符号说明（对齐官方 erDiagram.jison 语法）:
 *   - ZERO_OR_ONE:   |o / o|  零或一
 *   - ZERO_OR_MORE:  o{ / }o  零或多（o{ 为右侧形式，}o 为左侧形式）
 *   - ONE_OR_MORE:   |{ / }|  一或多（|{ 为右侧形式，}| 为左侧形式）
 *   - ONLY_ONE:      ||       仅一
 *   - MD_PARENT:     u        多对多父节点（仅左侧/source 端，后跟 -/.//|）
 */
export type ERCardinality =
  | 'zero-or-one'    // |o 零或一
  | 'zero-or-more'   // o{ 零或多
  | 'one-or-more'    // |{ 一或多
  | 'only-one'       // || 仅一
  | 'md-parent';     // u 多对多父节点（仅 source 端）

/** ER Diagram 关系类型（标识/非标识） */
export type ERIdentification = 'identifying' | 'non-identifying';

/** ER Diagram 属性键类型 */
export type ERAttributeKey = 'PK' | 'FK' | 'UK';

// ============================================================
// 7. State Diagram 状态类型（对齐官方 stateCommon.ts）
// ============================================================

/**
 * State Diagram 状态类型
 */
export type StateNodeType =
  | 'default'    // 默认状态
  | 'fork'       // Fork 状态
  | 'join'       // Join 状态
  | 'choice'     // 选择状态
  | 'divider'    // 分隔符
  | 'start'      // 起始状态
  | 'end';       // 结束状态

/** State Diagram 语句类型 */
export type StateStmtType =
  | 'state'
  | 'relation'
  | 'classDef'
  | 'styleDef'
  | 'applyClass'
  | 'direction'
  | 'root';

/** State Diagram Note 位置 */
export type StateNotePosition = 'left of' | 'right of';

// ============================================================
// 8. Mindmap 节点类型（对齐官方 mindmapDb.ts）
// ============================================================

/**
 * Mindmap 节点类型
 */
export type MindmapNodeType =
  | 'default'        // 默认（无边界）
  | 'rounded'        // (文本) 圆角矩形
  | 'rect'           // [文本] 矩形
  | 'circle'         // ((文本)) 圆形
  | 'cloud'          // (文本) 云形
  | 'bang'           // ))文本)) 爆炸形
  | 'hexagon';       // {{文本}} 六边形

// ============================================================
// 9. Architecture 类型（对齐官方 architectureTypes.ts）
// ============================================================

/** Architecture 方向 */
export type ArchitectureDirection = 'L' | 'R' | 'T' | 'B';

/** Architecture 对齐方式 */
export type ArchitectureAlignment = 'vertical' | 'horizontal' | 'bend';

// ============================================================
// 10. 通用基础类型
// ============================================================

/** 流程图方向 */
export type FlowchartDirection = 'TB' | 'TD' | 'BT' | 'RL' | 'LR';

/** 节点样式 */
export interface NodeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
  /** 其他任意 CSS 属性（保留 Mermaid 原始 style/classDef 中的所有属性） */
  [key: string]: string | number | undefined;
}

/** 边标记（与 React Flow EdgeMarker 兼容） */
export interface EdgeMarker {
  type: 'arrow' | 'arrowclosed';
  width?: number;
  height?: number;
  color?: string;
}

// ============================================================
// 11. 图表类型枚举
// ============================================================

/**
 * 12 种 Mermaid 图表类型
 * - 图结构类型（7种）：使用 GraphCanvasState，由 React Flow 渲染
 * - 数据图表类型（5种）：使用专用 CanvasState，由专用渲染器渲染
 */
export type DiagramType =
  // 图结构类型（7种）— 使用 GraphCanvasState
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'erDiagram'
  | 'mindmap'
  | 'stateDiagram'
  | 'architecture'
  // 数据图表类型（5种）— 使用专用 CanvasState
  | 'gantt'
  | 'pie'
  | 'timeline'
  | 'quadrantChart'
  | 'xychart';

/** 图结构类型集合（7种）— 共用 GraphCanvasState */
export type GraphDiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'classDiagram'
  | 'erDiagram'
  | 'mindmap'
  | 'stateDiagram'
  | 'architecture';

/** 数据图表类型集合（5种）— 各有专用 CanvasState */
export type ChartDiagramType =
  | 'gantt'
  | 'pie'
  | 'timeline'
  | 'quadrantChart'
  | 'xychart';

// ============================================================
// 12. 类型专用子类型定义
// ============================================================

/** classDiagram 类成员 */
export interface NodeMember {
  name: string;
  type?: string;
  visibility: ClassVisibility;
  isStatic: boolean;
  isAbstract: boolean;
  returnType?: string;
  isMethod: boolean;
  /** classDiagram: 方法参数（如 "param1: Type, param2: Type"） */
  parameters?: string;
}

/** erDiagram 实体属性 */
export interface NodeAttribute {
  name: string;
  type: string;
  keys: ERAttributeKey[];
  comment?: string;
}

/** sequenceDiagram 参与者信息 */
export interface SequenceParticipantInfo {
  id: string;
  label: string;
  participantType: 'participant' | 'actor';
}

/** sequenceDiagram 块信息（alt/opt/loop 等） */
export interface SequenceBlockInfo {
  type: SequenceBlockType;
  label?: string;
  startMessage: number;
  endMessage?: number;
}

/** sequenceDiagram 注释信息 */
export interface SequenceNoteInfo {
  participantId: string;
  position: 'left' | 'right' | 'over';
  label: string;
  messageIndex: number;
}

/** classDiagram 命名空间信息 */
export interface ClassNamespaceInfo {
  name: string;
  classIds: string[];
}

/** classDiagram 注释信息 */
export interface ClassNoteInfo {
  classId: string;
  position: 'left' | 'right' | 'top' | 'bottom';
  label: string;
}

/** architecture 分组信息（v4 根因修复：移除 title/in/icon，group 属性全部通过 nodes[] 表达）
 *
 * 单一数据源原则：
 *   - title → node.data.label（与其他节点类型一致）
 *   - in（父 group）→ node.parentId（与其他节点类型一致）
 *   - icon → node.data.archIcon（与 service 的 icon 统一）
 *   - id → 保留在此结构中（作为 group 索引）
 */
export interface ArchitectureGroupInfo {
  id: string;
}

/** architecture layout hint（v4 新增：UI 编辑 layout:row [a, b, c] 语法） */
export interface ArchitectureLayoutHint {
  direction: 'row' | 'column';
  /** 节点 ID 列表 */
  members: string[];
}

/** architecture 边方向信息 */
export interface ArchitectureEdgeInfo {
  lhsId: string;
  lhsDir: ArchitectureDirection;
  lhsInto: boolean;
  lhsGroup?: string;
  rhsId: string;
  rhsDir: ArchitectureDirection;
  rhsInto: boolean;
  rhsGroup?: string;
  title?: string;
}

/** stateDiagram 复合状态信息 */
export interface StateCompositeInfo {
  stateId: string;
  childStateIds: string[];
  direction?: FlowchartDirection;
}

/** stateDiagram Note 信息 */
export interface StateNoteInfo {
  stateId: string;
  position: StateNotePosition;
  label: string;
}

/** stateDiagram classDef 信息 */
export interface StateClassDefInfo {
  name: string;
  style: string;
}

/** flowchart classDef 信息（对齐官方 FlowClass，保留完整 styles/textStyles） */
export interface FlowClassDefInfo {
  /** classDef id */
  id: string;
  /** 样式列表 */
  styles: string[];
  /** 文本样式列表（color 相关，fill 替换为 bgFill） */
  textStyles: string[];
}

/** erDiagram 子图信息（对应 metadata.erSubgraphs） */
export interface ErSubGraphInfo {
  /** 子图 ID */
  id: string;
  /** 子图标题 */
  title: string;
  /** 子图包含的节点 ID 列表 */
  nodes: string[];
  /** 子图应用的 CSS 类名列表 */
  classes: string[];
  /** 子图方向（TB/BT/RL/LR，可选） */
  dir?: string;
}

/** erDiagram 样式类信息（对应 metadata.erClasses） */
export interface ErClassInfo {
  /** classDef id */
  id: string;
  /** 样式列表 */
  styles: string[];
  /** 文本样式列表 */
  textStyles: string[];
}

/** mindmap 节点装饰信息 */
export interface MindmapDecorationInfo {
  nodeId: string;
  icon?: string;
  className?: string;
}

// ============================================================
// 13. 节点数据（统一类型，禁止各模块重新定义）
// ============================================================

/**
 * Mermaid 节点数据
 * 统一类型定义，所有模块引用此类型，禁止重新定义
 * 索引签名满足 React Flow Record<string, unknown> 约束
 */
export interface MermaidNodeData {
  label: string;
  shape: MermaidShapeType;
  style?: NodeStyle;
  // === 类型专用字段（可选，通过 diagramType 约束）===
  /** classDiagram: 类成员列表 */
  members?: NodeMember[];
  /** erDiagram: 实体属性列表 */
  attributes?: NodeAttribute[];
  /** stateDiagram: 特殊状态类型 */
  stateType?: StateNodeType;
  /** stateDiagram: 状态描述（带描述状态） */
  stateDescription?: string;
  /** sequenceDiagram: 参与者类型 */
  participantType?: 'participant' | 'actor';
  /** mindmap: 节点形状 */
  mindmapType?: MindmapNodeType;
  /** mindmap: 节点图标 */
  mindmapIcon?: string;
  /** mindmap: 节点 CSS 类 */
  mindmapClass?: string;
  /** architecture: 服务图标 */
  archIcon?: string;
  /** architecture: 服务图标文本 */
  archIconText?: string;
  /** architecture: 是否为 junction */
  archIsJunction?: boolean;
  /** classDiagram: 类可见性（用于命名空间内） */
  classNamespace?: string;
  /** classDiagram: 注释列表 */
  classNotes?: ClassNoteInfo[];
  /** 通用: classDef 应用的 CSS 类名列表 */
  classNames?: string[];
  /** 通用: 点击事件 URL */
  clickUrl?: string;
  /** 通用: 点击事件回调名 */
  clickCallback?: string;
  /** 通用: tooltip */
  tooltip?: string;
  [key: string]: unknown;
}

// ============================================================
// 14. 边数据（统一类型，禁止各模块重新定义）
// ============================================================

/**
 * Mermaid 边数据
 * 统一类型定义，所有模块引用此类型，禁止重新定义
 * 索引签名满足 React Flow Record<string, unknown> 约束
 */
export interface MermaidEdgeData {
  edgeStyle: MermaidEdgeStyle;
  label?: string;
  // === 类型专用字段（可选，通过 diagramType 约束）===
  /** classDiagram: 关系类型 */
  relationType?: ClassRelationType;
  /** classDiagram: 线型 */
  lineType?: ClassLineType;
  /** classDiagram: 起始端关系类型（双端关系） */
  startRelationType?: ClassRelationType;
  /** classDiagram: 结束端关系类型（双端关系） */
  endRelationType?: ClassRelationType;
  /** classDiagram: 关系标签 */
  relationLabel?: string;
  /** erDiagram: 基数 */
  cardinality?: { from: ERCardinality; to: ERCardinality };
  /** erDiagram: 关系类型（标识/非标识） */
  erIdentification?: ERIdentification;
  /** erDiagram: 角色标签 */
  erRole?: string;
  /** sequenceDiagram: 消息箭头类型 */
  messageType?: SequenceArrowType;
  /** sequenceDiagram: 消息顺序（时间轴位置） */
  sequence?: number;
  /** sequenceDiagram: 是否激活参与者 */
  activate?: boolean;
  /** sequenceDiagram: 是否停用参与者（对应 `-` 后缀） */
  deactivate?: boolean;
  /** stateDiagram: 转换标签 */
  transitionLabel?: string;
  /** architecture: 边方向信息 */
  archEdge?: ArchitectureEdgeInfo;
  /** 通用: classDef 应用的 CSS 类名列表 */
  classNames?: string[];
  /** flowchart: 是否为回路边 */
  isBackEdge?: boolean;
  /** flowchart: 布局阶段计算的 source 连接方向 */
  sourcePosition?: 'top' | 'bottom' | 'left' | 'right';
  /** flowchart: 布局阶段计算的 target 连接方向 */
  targetPosition?: 'top' | 'bottom' | 'left' | 'right';
  [key: string]: unknown;
}

// ============================================================
// 15. 画布节点和边（与 React Flow 兼容）
// ============================================================

/**
 * 画布节点（与 React Flow Node 结构兼容）
 * 顶层不加索引签名，否则 NodeProps 的 Pick 会将 width/height 等视为 required
 */
export interface MermaidNode {
  id: string;
  /** React Flow 节点类型（如 'default'、'subgraph'、'sequence-participant'），决定渲染组件 */
  type?: string;
  position: { x: number; y: number };
  data: MermaidNodeData;
  parentId?: string;
  extent?: 'parent' | [[number, number], [number, number]];
  selected?: boolean;
  dragging?: boolean;
  width?: number;
  height?: number;
  zIndex?: number;
}

/**
 * 画布边（与 React Flow Edge 结构兼容）
 */
export interface MermaidEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data: MermaidEdgeData;
  markerStart?: EdgeMarker;
  markerEnd?: EdgeMarker;
  /** React Flow EdgeBase 兼容字段：源节点 Handle ID（如 'left'/'right'/'top'/'bottom'） */
  sourceHandle?: string | null;
  /** React Flow EdgeBase 兼容字段：目标节点 Handle ID */
  targetHandle?: string | null;
  selected?: boolean;
  animated?: boolean;
  zIndex?: number;
}

/** 画布视口 */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// ============================================================
// 16. GraphMetadata 联合类型（按 diagramType 区分有效字段）
// ============================================================

/**
 * 图结构类型元数据
 * 按 diagramType 区分有效字段，所有图结构类型共用此接口
 * 各字段都是可选的，由各图表类型的解析器/序列化器负责填充和读取
 */
export interface GraphMetadata {
  /** sequenceDiagram 专用: 参与者信息 */
  participants?: SequenceParticipantInfo[];
  /** sequenceDiagram 专用: 块信息（alt/opt/loop 等） */
  blocks?: SequenceBlockInfo[];
  /** sequenceDiagram 专用: 注释信息 */
  notes?: SequenceNoteInfo[];
  /** sequenceDiagram 专用: autonumber 状态 */
  autonumber?: boolean;
  /** classDiagram 专用: 命名空间信息 */
  namespaces?: ClassNamespaceInfo[];
  /** classDiagram 专用: classDef 定义 */
  classDefs?: StateClassDefInfo[];
  /** stateDiagram 专用: 复合状态信息 */
  composites?: StateCompositeInfo[];
  /** stateDiagram 专用: Note 信息 */
  stateNotes?: StateNoteInfo[];
  /** stateDiagram 专用: classDef 定义 */
  stateClassDefs?: StateClassDefInfo[];
  /** stateDiagram 专用: 方向 */
  stateDirection?: FlowchartDirection;
  /** architecture 专用: 分组信息（v4：移除 nodeIds，成员通过 parentId 派生） */
  groups?: ArchitectureGroupInfo[];
  /** architecture 专用: 边方向信息 */
  archEdges?: ArchitectureEdgeInfo[];
  /** architecture 专用: layout hints（v4 新增：UI 编辑 layout:row [a, b, c] 语法） */
  layoutHints?: ArchitectureLayoutHint[];
  /** mindmap 专用: 节点装饰信息 */
  mindmapDecorations?: MindmapDecorationInfo[];
  /** erDiagram 专用: 子图信息 */
  erSubgraphs?: ErSubGraphInfo[];
  /** erDiagram 专用: 样式类定义 */
  erClasses?: ErClassInfo[];
  /** 通用: classDef 定义（flowchart 等） */
  flowClassDefs?: FlowClassDefInfo[];
  /** 通用: title */
  title?: string;
  /** 通用: accessibility 标题 */
  accTitle?: string;
  /** 通用: accessibility 描述 */
  accDescription?: string;
  [key: string]: unknown;
}

// ============================================================
// 17. 画布状态（判别联合类型）
// ============================================================

/**
 * 图结构类型共用状态（7种图结构类型使用）
 * nodes/edges 为权威数据源，其他字段为派生或元数据
 */
export interface GraphCanvasState {
  diagramType: GraphDiagramType;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  /** flowchart 专用方向 */
  direction?: FlowchartDirection;
  /** 各类型特有元数据（按 diagramType 区分有效字段） */
  metadata?: GraphMetadata;
  /** M0 新增：原始 Mermaid 代码（用于增量序列化保持格式） */
  rawCode?: string;
}

/**
 * Gantt 甘特图状态
 * 扩展 accTitle/accDescription 字段
 */
export interface GanttCanvasState {
  diagramType: 'gantt';
  title?: string;
  accTitle?: string;
  accDescription?: string;
  /** dateFormat 必填（官方 gantt 语法要求，否则无法解析日期） */
  dateFormat: string;
  axisFormat?: string;
  tickInterval?: string;
  todayMarker?: string;
  excludes?: string[];
  includes?: string[];
  /** weekday 关键字：官方只支持 sunday/monday（设置周起始日） */
  weekday?: 'sunday' | 'monday';
  weekend?: 'friday' | 'saturday';
  inclusiveEndDates?: boolean;
  topAxis?: boolean;
  displayMode?: 'compact' | 'regular';
  sections: GanttSection[];
  /** M0 新增：原始 Mermaid 代码（用于增量序列化保持格式） */
  rawCode?: string;
}

/** Gantt 任务区段 */
export interface GanttSection {
  name: string;
  tasks: GanttTask[];
}

/**
 * Gantt 任务
 * 统一定义，禁止各模块重新定义
 *
 * v4 根因修复（单一数据源原则）：
 *   - 移除 status 字段，统一使用 tags: string[]（支持多标签组合，如 ['done', 'crit']）
 *   - 移除 afterId 字段，统一使用 dependencies: string[]（支持多依赖，如 ['t1', 't2']）
 *   - 新增 clickUrl 字段，存储 click href URL（单一数据源：task 是权威来源）
 */
export interface GanttTask {
  id?: string;
  label: string;
  /** v4：移除 status，统一使用 tags（多标签组合） */
  startDate?: string;
  /** v4：移除 afterId，统一使用 dependencies（多依赖） */
  duration?: string;
  endDate?: string;
  /** 多标签组合（如 ['done', 'crit']），不限制具体值 */
  tags?: string[];
  /** 多依赖（如 ['t1', 't2']），对应官方 after t1 t2 语法 */
  dependencies?: string[];
  priority?: 'high' | 'medium' | 'low';
  /** v4 新增：click href URL（单一数据源：task 是权威来源） */
  clickUrl?: string;
}

/**
 * Pie 饼图状态
 * 扩展 accTitle/accDescription 字段
 */
export interface PieCanvasState {
  diagramType: 'pie';
  title?: string;
  accTitle?: string;
  accDescription?: string;
  showData?: boolean;
  slices: PieSlice[];
  /** M0 新增：原始 Mermaid 代码（用于增量序列化保持格式） */
  rawCode?: string;
}

/** Pie 饼图切片 */
export interface PieSlice {
  label: string;
  value: number;
}

/**
 * Timeline 时间线状态
 * 扩展 accTitle/accDescription 字段
 */
export interface TimelineCanvasState {
  diagramType: 'timeline';
  title?: string;
  accTitle?: string;
  accDescription?: string;
  direction?: 'LR' | 'TB';
  sections: TimelineSection[];
  /** M0 新增：原始 Mermaid 代码（用于增量序列化保持格式） */
  rawCode?: string;
}

/** Timeline 区段 */
export interface TimelineSection {
  name?: string;
  periods: TimelinePeriod[];
}

/** Timeline 时间段 */
export interface TimelinePeriod {
  label: string;
  events: TimelineEvent[];
}

/** Timeline 事件 */
export interface TimelineEvent {
  label: string;
}

/**
 * QuadrantChart 四象限图状态
 * 扩展 accTitle/accDescription 字段
 * 坐标归一化到 0-1 范围
 */
export interface QuadrantCanvasState {
  diagramType: 'quadrantChart';
  title?: string;
  accTitle?: string;
  accDescription?: string;
  quadrants: {
    '1': string;  // 右上象限标题
    '2': string;  // 左上象限标题
    '3': string;  // 左下象限标题
    '4': string;  // 右下象限标题
  };
  xAxis: { leftText: string; rightText: string };
  yAxis: { topText: string; bottomText: string };
  points: QuadrantPoint[];
  classDefs?: StateClassDefInfo[];
  /** M0 新增：原始 Mermaid 代码（用于增量序列化保持格式） */
  rawCode?: string;
}

/** QuadrantChart 数据点（坐标归一化 0-1） */
export interface QuadrantPoint {
  label: string;
  x: number;  // 0-1
  y: number;  // 0-1
  className?: string;
  style?: NodeStyle;
  /** 数据点半径（quadrant 特有样式，对应官方 `radius: N`） */
  radius?: number;
}

/**
 * XYChart 坐标图状态
 * 扩展 accTitle/accDescription 字段
 */
export interface XYChartCanvasState {
  diagramType: 'xychart';
  title?: string;
  accTitle?: string;
  accDescription?: string;
  orientation?: 'horizontal' | 'vertical';
  showDataLabel?: boolean;
  plotColorPalette?: string;
  xAxis: XYAxis;
  yAxis: XYAxis;
  series: XYSeries[];
  classDefs?: StateClassDefInfo[];
  /** M0 新增：原始 Mermaid 代码（用于增量序列化保持格式） */
  rawCode?: string;
}

/** XYChart 坐标轴 */
export interface XYAxis {
  type: 'band' | 'linear';  // x: band/linear, y: linear only
  title?: string;
  min?: number;
  max?: number;
  categories?: string[];  // type='band' 时
  data?: number[];        // type='linear' 时
}

/** XYChart 数据系列 */
export interface XYSeries {
  name?: string;
  type: 'line' | 'bar';
  data: number[];
  color?: string;
  className?: string;
}

/**
 * 画布状态 — 判别联合类型
 * 通过 diagramType 字段区分具体类型
 */
export type CanvasState =
  | GraphCanvasState
  | GanttCanvasState
  | PieCanvasState
  | TimelineCanvasState
  | QuadrantCanvasState
  | XYChartCanvasState;

/**
 * 图结构画布更新（部分字段）
 * 用于 updateActiveCanvas 等 API，仅支持图结构类型的部分更新
 */
export interface GraphCanvasUpdate {
  nodes?: MermaidNode[];
  edges?: MermaidEdge[];
  direction?: FlowchartDirection;
  metadata?: GraphMetadata;
  /** 原始 Mermaid 代码（用于增量序列化保留格式） */
  rawCode?: string;
}

// ============================================================
// 18. 类型守卫
// ============================================================

const GRAPH_DIAGRAM_TYPES: ReadonlySet<GraphDiagramType> = new Set([
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'erDiagram',
  'mindmap',
  'stateDiagram',
  'architecture',
]);

const CHART_DIAGRAM_TYPES: ReadonlySet<ChartDiagramType> = new Set([
  'gantt',
  'pie',
  'timeline',
  'quadrantChart',
  'xychart',
]);

/** 判断图表类型是否为图结构类型 */
export function isGraphDiagramType(type: DiagramType): type is GraphDiagramType {
  return GRAPH_DIAGRAM_TYPES.has(type as GraphDiagramType);
}

/** 判断图表类型是否为数据图表类型 */
export function isChartDiagramType(type: DiagramType): type is ChartDiagramType {
  return CHART_DIAGRAM_TYPES.has(type as ChartDiagramType);
}

/** 判断画布状态是否为图结构类型 */
export function isGraphCanvasState(state: CanvasState): state is GraphCanvasState {
  return isGraphDiagramType(state.diagramType);
}

/** 判断画布状态是否为 Gantt 甘特图 */
export function isGanttCanvasState(state: CanvasState): state is GanttCanvasState {
  return state.diagramType === 'gantt';
}

/** 判断画布状态是否为 Pie 饼图 */
export function isPieCanvasState(state: CanvasState): state is PieCanvasState {
  return state.diagramType === 'pie';
}

/** 判断画布状态是否为 Timeline 时间线 */
export function isTimelineCanvasState(state: CanvasState): state is TimelineCanvasState {
  return state.diagramType === 'timeline';
}

/** 判断画布状态是否为 QuadrantChart 四象限图 */
export function isQuadrantCanvasState(state: CanvasState): state is QuadrantCanvasState {
  return state.diagramType === 'quadrantChart';
}

/** 判断画布状态是否为 XYChart 坐标图 */
export function isXYChartCanvasState(state: CanvasState): state is XYChartCanvasState {
  return state.diagramType === 'xychart';
}

// ============================================================
// 19. 迁移函数和工厂函数
// ============================================================

/**
 * 迁移旧版 CanvasState 到新版
 * 支持所有图表类型的迁移
 *
 * 唯一权威实现，其他模块直接调用此函数
 */
export function migrateCanvasState(state: unknown): CanvasState {
  if (typeof state !== 'object' || state === null) {
    return createEmptyCanvasState('flowchart');
  }

  const raw = state as Record<string, unknown>;
  const diagramType = raw.diagramType;

  // 旧版无 diagramType 数据迁移为 flowchart
  if (typeof diagramType !== 'string') {
    return migrateLegacyFlowchart(raw);
  }

  // 类型断言: 经过 string 检查后，断言为 DiagramType
  const typedDiagramType = diagramType as DiagramType;

  if (isGraphDiagramType(typedDiagramType)) {
    return migrateGraphCanvasState(raw, typedDiagramType);
  }

  switch (typedDiagramType) {
    case 'gantt':
      return migrateGanttCanvasState(raw);
    case 'pie':
      return migratePieCanvasState(raw);
    case 'timeline':
      return migrateTimelineCanvasState(raw);
    case 'quadrantChart':
      return migrateQuadrantCanvasState(raw);
    case 'xychart':
      return migrateXYChartCanvasState(raw);
    default:
      return createEmptyCanvasState('flowchart');
  }
}

/**
 * 创建指定类型的空画布状态
 * 用于图表类型切换时初始化新类型的空白画布
 */
export function createEmptyCanvasState(diagramType: DiagramType): CanvasState {
  if (isGraphDiagramType(diagramType)) {
    return {
      diagramType,
      nodes: [],
      edges: [],
    };
  }

  switch (diagramType) {
    case 'gantt':
      return { diagramType: 'gantt', dateFormat: '', sections: [] };
    case 'pie':
      return { diagramType: 'pie', slices: [] };
    case 'timeline':
      return { diagramType: 'timeline', sections: [] };
    case 'quadrantChart':
      return {
        diagramType: 'quadrantChart',
        quadrants: { '1': '', '2': '', '3': '', '4': '' },
        xAxis: { leftText: '', rightText: '' },
        yAxis: { topText: '', bottomText: '' },
        points: [],
      };
    case 'xychart':
      return {
        diagramType: 'xychart',
        xAxis: { type: 'band', categories: [] },
        yAxis: { type: 'linear' },
        series: [],
      };
    default:
      return { diagramType: 'flowchart', nodes: [], edges: [] };
  }
}

// ============================================================
// 迁移辅助函数（内部使用）
// ============================================================

function migrateLegacyFlowchart(raw: Record<string, unknown>): GraphCanvasState {
  const nodes = Array.isArray(raw.nodes) ? (raw.nodes as MermaidNode[]) : [];
  const edges = Array.isArray(raw.edges) ? (raw.edges as MermaidEdge[]) : [];
  const direction = typeof raw.direction === 'string' ? (raw.direction as FlowchartDirection) : undefined;
  const metadata = raw.metadata && typeof raw.metadata === 'object'
    ? (raw.metadata as GraphMetadata)
    : undefined;

  return {
    diagramType: 'flowchart',
    nodes,
    edges,
    direction,
    metadata,
  };
}

function migrateGraphCanvasState(
  raw: Record<string, unknown>,
  diagramType: GraphDiagramType,
): GraphCanvasState {
  const nodes = Array.isArray(raw.nodes) ? (raw.nodes as MermaidNode[]) : [];
  const edges = Array.isArray(raw.edges) ? (raw.edges as MermaidEdge[]) : [];
  const direction = typeof raw.direction === 'string' ? (raw.direction as FlowchartDirection) : undefined;
  const metadata = raw.metadata && typeof raw.metadata === 'object'
    ? (raw.metadata as GraphMetadata)
    : undefined;

  return {
    diagramType,
    nodes,
    edges,
    direction,
    metadata,
  };
}

function migrateGanttCanvasState(raw: Record<string, unknown>): GanttCanvasState {
  const sections = Array.isArray(raw.sections) ? (raw.sections as GanttSection[]) : [];
  return {
    diagramType: 'gantt',
    title: typeof raw.title === 'string' ? raw.title : undefined,
    accTitle: typeof raw.accTitle === 'string' ? raw.accTitle : undefined,
    accDescription: typeof raw.accDescription === 'string' ? raw.accDescription : undefined,
    dateFormat: typeof raw.dateFormat === 'string' ? raw.dateFormat : '',
    axisFormat: typeof raw.axisFormat === 'string' ? raw.axisFormat : undefined,
    tickInterval: typeof raw.tickInterval === 'string' ? raw.tickInterval : undefined,
    todayMarker: typeof raw.todayMarker === 'string' ? raw.todayMarker : undefined,
    excludes: Array.isArray(raw.excludes) ? (raw.excludes as string[]) : undefined,
    includes: Array.isArray(raw.includes) ? (raw.includes as string[]) : undefined,
    weekday: typeof raw.weekday === 'string' ? (raw.weekday as GanttCanvasState['weekday']) : undefined,
    weekend: typeof raw.weekend === 'string' ? (raw.weekend as GanttCanvasState['weekend']) : undefined,
    inclusiveEndDates: typeof raw.inclusiveEndDates === 'boolean' ? raw.inclusiveEndDates : undefined,
    topAxis: typeof raw.topAxis === 'boolean' ? raw.topAxis : undefined,
    displayMode: typeof raw.displayMode === 'string' ? (raw.displayMode as GanttCanvasState['displayMode']) : undefined,
    sections,
  };
}

function migratePieCanvasState(raw: Record<string, unknown>): PieCanvasState {
  const slices = Array.isArray(raw.slices) ? (raw.slices as PieSlice[]) : [];
  return {
    diagramType: 'pie',
    title: typeof raw.title === 'string' ? raw.title : undefined,
    accTitle: typeof raw.accTitle === 'string' ? raw.accTitle : undefined,
    accDescription: typeof raw.accDescription === 'string' ? raw.accDescription : undefined,
    showData: typeof raw.showData === 'boolean' ? raw.showData : undefined,
    slices,
  };
}

function migrateTimelineCanvasState(raw: Record<string, unknown>): TimelineCanvasState {
  // 旧版 periods 字段迁移到 sections
  let sections: TimelineSection[] = [];
  if (Array.isArray(raw.sections)) {
    sections = raw.sections as TimelineSection[];
  } else if (Array.isArray(raw.periods)) {
    // 旧版 periods 迁移
    sections = [{
      name: undefined,
      periods: raw.periods as TimelinePeriod[],
    }];
  }

  return {
    diagramType: 'timeline',
    title: typeof raw.title === 'string' ? raw.title : undefined,
    accTitle: typeof raw.accTitle === 'string' ? raw.accTitle : undefined,
    accDescription: typeof raw.accDescription === 'string' ? raw.accDescription : undefined,
    direction: typeof raw.direction === 'string' ? (raw.direction as 'LR' | 'TB') : undefined,
    sections,
  };
}

function migrateQuadrantCanvasState(raw: Record<string, unknown>): QuadrantCanvasState {
  const quadrants = (raw.quadrants && typeof raw.quadrants === 'object')
    ? (raw.quadrants as QuadrantCanvasState['quadrants'])
    : { '1': '', '2': '', '3': '', '4': '' };

  const xAxis = (raw.xAxis && typeof raw.xAxis === 'object')
    ? (raw.xAxis as QuadrantCanvasState['xAxis'])
    : { leftText: '', rightText: '' };

  const yAxis = (raw.yAxis && typeof raw.yAxis === 'object')
    ? (raw.yAxis as QuadrantCanvasState['yAxis'])
    : { topText: '', bottomText: '' };

  // 旧版坐标 0-100 迁移到 0-1 归一化
  let points: QuadrantPoint[] = [];
  if (Array.isArray(raw.points)) {
    points = (raw.points as QuadrantPoint[]).map((p) => ({
      label: p.label,
      x: p.x > 1 ? p.x / 100 : p.x,  // 旧版 0-100 迁移到 0-1
      y: p.y > 1 ? p.y / 100 : p.y,
      className: p.className,
      style: p.style,
      radius: p.radius,
    }));
  }

  return {
    diagramType: 'quadrantChart',
    title: typeof raw.title === 'string' ? raw.title : undefined,
    accTitle: typeof raw.accTitle === 'string' ? raw.accTitle : undefined,
    accDescription: typeof raw.accDescription === 'string' ? raw.accDescription : undefined,
    quadrants,
    xAxis,
    yAxis,
    points,
    classDefs: Array.isArray(raw.classDefs) ? (raw.classDefs as StateClassDefInfo[]) : undefined,
  };
}

function migrateXYChartCanvasState(raw: Record<string, unknown>): XYChartCanvasState {
  // 旧版 'category' 轴类型迁移到 'band'
  const migrateAxis = (axis: unknown): XYAxis => {
    if (!axis || typeof axis !== 'object') {
      return { type: 'linear' };
    }
    const a = axis as Record<string, unknown>;
    const type = a.type === 'category' ? 'band' : (a.type === 'band' || a.type === 'linear' ? a.type : 'linear');
    return {
      type: type as 'band' | 'linear',
      title: typeof a.title === 'string' ? a.title : undefined,
      min: typeof a.min === 'number' ? a.min : undefined,
      max: typeof a.max === 'number' ? a.max : undefined,
      categories: Array.isArray(a.categories) ? (a.categories as string[]) : undefined,
      data: Array.isArray(a.data) ? (a.data as number[]) : undefined,
    };
  };

  return {
    diagramType: 'xychart',
    title: typeof raw.title === 'string' ? raw.title : undefined,
    accTitle: typeof raw.accTitle === 'string' ? raw.accTitle : undefined,
    accDescription: typeof raw.accDescription === 'string' ? raw.accDescription : undefined,
    orientation: typeof raw.orientation === 'string' ? (raw.orientation as 'horizontal' | 'vertical') : undefined,
    showDataLabel: typeof raw.showDataLabel === 'boolean' ? raw.showDataLabel : undefined,
    plotColorPalette: typeof raw.plotColorPalette === 'string' ? raw.plotColorPalette : undefined,
    xAxis: migrateAxis(raw.xAxis),
    yAxis: migrateAxis(raw.yAxis),
    series: Array.isArray(raw.series) ? (raw.series as XYSeries[]) : [],
    classDefs: Array.isArray(raw.classDefs) ? (raw.classDefs as StateClassDefInfo[]) : undefined,
  };
}

// ============================================================
// 20. 画布内容来源和消费状态
// ============================================================

export type CanvasSource = 'user' | 'ai' | null;

export interface ConsumedState {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
}

// ============================================================
// 21. 解析结果和序列化结果
// ============================================================

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

// ============================================================
// 22. 多标签页视图类型
// ============================================================

export type ViewSource = 'user' | 'ai';

export interface ViewSummary {
  id: string;
  title: string | null;
  createdAt: number;
  updatedAt: number;
  sessionId: string | null;
  source: ViewSource;
  diagramType: DiagramType;
}

export interface ViewContent {
  canvas: CanvasState;
  consumed: ConsumedState;
  viewport: Viewport;
}

export interface View extends ViewSummary, ViewContent {}

export interface ActiveViewPayload {
  viewId: string;
  canvas: CanvasState;
  consumed: ConsumedState;
  viewport: Viewport;
  title: string | null;
}
