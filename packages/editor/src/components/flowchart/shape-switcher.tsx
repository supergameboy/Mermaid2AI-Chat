/**
 * 形状切换器 — 选中节点后切换形状
 *
 * 单一职责：提供形状选择 UI，触发 onChange 回调
 *
 * 数据流:
 *   MermaidNode.data.shape → ShapeSwitcher → onChange(newShape) → 更新 CanvasState
 */

import { memo } from 'react';
import type { MermaidShapeType } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface ShapeSwitcherProps {
  /** 当前形状 */
  currentShape: MermaidShapeType;
  /** 切换形状回调 */
  onChange: (shape: MermaidShapeType) => void;
}

// ============================================================
// 常量
// ============================================================

/** flowchart 常用形状列表（按官方 jison 语法分组） */
const SHAPE_GROUPS: { group: string; shapes: { value: MermaidShapeType; label: string; syntax: string }[] }[] = [
  {
    group: '基本形状',
    shapes: [
      { value: 'rect', label: '矩形', syntax: 'id[文本]' },
      { value: 'rounded', label: '圆角矩形', syntax: 'id(文本)' },
      { value: 'stadium', label: '体育场形', syntax: 'id([文本])' },
      { value: 'ellipse', label: '椭圆', syntax: 'id(-文本-)' },
      { value: 'circle', label: '圆形', syntax: 'id((文本))' },
      { value: 'doublecircle', label: '双圆', syntax: 'id(((文本)))' },
      { value: 'diamond', label: '菱形', syntax: 'id{文本}' },
      { value: 'hexagon', label: '六边形', syntax: 'id{{文本}}' },
    ],
  },
  {
    group: '特殊形状',
    shapes: [
      { value: 'subroutine', label: '子程序', syntax: 'id[[文本]]' },
      { value: 'cylinder', label: '圆柱体', syntax: 'id[(文本)]' },
      { value: 'odd', label: '奇形', syntax: 'id>文本]' },
      { value: 'trapezoid', label: '梯形', syntax: 'id[/文本/]' },
      { value: 'trapezoid-reverse', label: '倒梯形', syntax: 'id[\\文本\\]' },
      { value: 'lean-right', label: '右倾斜', syntax: 'id[/文本\\]' },
      { value: 'lean-left', label: '左倾斜', syntax: 'id[\\文本/]' },
    ],
  },
  {
    group: '扩展形状',
    shapes: [
      { value: 'text', label: '文本块', syntax: 'text' },
      { value: 'document', label: '文档', syntax: 'document' },
      { value: 'note', label: '便签', syntax: 'note' },
      { value: 'triangle', label: '三角形', syntax: 'triangle' },
      { value: 'cloud', label: '云形', syntax: 'cloud' },
      { value: 'bang', label: '爆炸形', syntax: 'bang' },
      { value: 'fork-join', label: 'Fork/Join', syntax: 'fork-join' },
      { value: 'hourglass', label: '沙漏', syntax: 'hourglass' },
      { value: 'lightning-bolt', label: '闪电', syntax: 'lightning-bolt' },
    ],
  },
];

// ============================================================
// 组件
// ============================================================

export const ShapeSwitcher = memo(function ShapeSwitcher({
  currentShape,
  onChange,
}: ShapeSwitcherProps) {
  return (
    <div className="shape-switcher" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>切换形状</h4>

      {SHAPE_GROUPS.map((group) => (
        <div key={group.group} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '12px', color: '#666', fontWeight: 500 }}>{group.group}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px' }}>
            {group.shapes.map((shape) => {
              const isActive = currentShape === shape.value;
              return (
                <button
                  key={shape.value}
                  title={shape.syntax}
                  onClick={() => onChange(shape.value)}
                  style={{
                    padding: '6px 8px',
                    border: isActive ? '1px solid #1890ff' : '1px solid #d9d9d9',
                    borderRadius: '4px',
                    backgroundColor: isActive ? '#e6f7ff' : '#fff',
                    color: isActive ? '#1890ff' : '#333',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'all 0.2s',
                  }}
                >
                  {shape.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
});
