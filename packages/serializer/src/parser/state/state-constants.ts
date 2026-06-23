/**
 * State Diagram 常量定义
 *
 * 移植自官方 mermaid stateCommon.ts
 * 单一职责：提供 stateDiagram 解析/序列化所需的常量
 */

// 默认图表方向
export const DEFAULT_DIAGRAM_DIRECTION = 'TB';

// 复合状态（嵌套文档）的默认方向
export const DEFAULT_NESTED_DOC_DIR = 'TB';

// 语句类型（jison 产物）
export const STMT_DIRECTION = 'dir';
export const STMT_STATE = 'state';
export const STMT_ROOT = 'root';
export const STMT_RELATION = 'relation';
export const STMT_CLASSDEF = 'classDef';
export const STMT_STYLEDEF = 'style';
export const STMT_APPLYCLASS = 'applyClass';

// 默认状态类型
export const DEFAULT_STATE_TYPE = 'default';

// 分隔符类型（并发区域）
export const DIVIDER_TYPE = 'divider';

// 节点形状（对齐官方 shapes）
export const SHAPE_STATE = 'rect';
export const SHAPE_STATE_WITH_DESC = 'rectWithTitle';
export const SHAPE_START = 'stateStart';
export const SHAPE_END = 'stateEnd';
export const SHAPE_DIVIDER = 'divider';
export const SHAPE_GROUP = 'roundedWithTitle';
export const SHAPE_NOTE = 'note';
export const SHAPE_NOTEGROUP = 'noteGroup';

// 起止节点常量
export const START_NODE = '[*]';
export const START_TYPE = 'start';
export const END_NODE = '[*]';
export const END_TYPE = 'end';

// classDef 分隔符
export const STYLECLASS_SEP = ',';

// 颜色关键字（用于 classDef 样式分离）
export const COLOR_KEYWORD = 'color';
export const FILL_KEYWORD = 'fill';
export const BG_FILL = 'bgFill';

// DOM ID 类型标识
export const DOMID_STATE = 'state';
export const DOMID_TYPE_SPACER = '----';
export const NOTE = 'note';
export const PARENT = 'parent';
export const NOTE_ID = `${DOMID_TYPE_SPACER}${NOTE}`;
export const PARENT_ID = `${DOMID_TYPE_SPACER}${PARENT}`;

// 图边样式（对齐官方 G_EDGE_*）
export const G_EDGE_STYLE = 'fill:none';
export const G_EDGE_ARROWHEADSTYLE = 'fill: #333';
export const G_EDGE_LABELPOS = 'c';
export const G_EDGE_LABELTYPE = 'markdown';
export const G_EDGE_THICKNESS = 'normal';
