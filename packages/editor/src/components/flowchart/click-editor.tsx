/**
 * click 编辑面板 — 编辑节点的 click 交互（href 链接、callback 调用、tooltip）
 *
 * 单一职责：提供 FlowClickEvent 的编辑 UI
 *
 * 数据流:
 *   FlowClickEvent → ClickEditor → onUpdate(nodeId, Partial<FlowClickEvent>) → 更新 CanvasState
 *
 * click 语法:
 *   click nodeId href "https://example.com" _blank
 *   click nodeId call callbackFunction()
 *   click nodeId tooltip "提示文本"
 */

import { memo, useState, useEffect } from 'react';
import type { FlowClickEvent } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface ClickEditorProps {
  /** 节点 ID */
  nodeId: string;
  /** 当前 click 事件（可选） */
  clickEvent?: FlowClickEvent;
  /** 更新 click 事件 */
  onUpdate: (nodeId: string, event: Partial<FlowClickEvent>) => void;
  /** 清除 click 事件 */
  onClear: (nodeId: string) => void;
}

// ============================================================
// 组件
// ============================================================

export const ClickEditor = memo(function ClickEditor({
  nodeId,
  clickEvent,
  onUpdate,
  onClear,
}: ClickEditorProps) {
  const [link, setLink] = useState(clickEvent?.link ?? '');
  const [linkTarget, setLinkTarget] = useState(clickEvent?.linkTarget ?? '_self');
  const [tooltip, setTooltip] = useState(clickEvent?.tooltip ?? '');
  const [functionName, setFunctionName] = useState(clickEvent?.functionName ?? '');

  // 同步外部更新
  useEffect(() => {
    setLink(clickEvent?.link ?? '');
    setLinkTarget(clickEvent?.linkTarget ?? '_self');
    setTooltip(clickEvent?.tooltip ?? '');
    setFunctionName(clickEvent?.functionName ?? '');
  }, [clickEvent]);

  const handleSaveLink = () => {
    if (link) {
      onUpdate(nodeId, { link, linkTarget });
    }
  };

  const handleSaveTooltip = () => {
    if (tooltip) {
      onUpdate(nodeId, { tooltip });
    }
  };

  const handleSaveCallback = () => {
    if (functionName) {
      onUpdate(nodeId, { functionName });
    }
  };

  return (
    <div className="click-editor" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>交互设置</h4>

      {/* href 链接 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>超链接 (href)</span>
        <input
          type="text"
          placeholder="https://example.com"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          style={inputStyle}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
          <span>打开方式:</span>
          <select
            value={linkTarget}
            onChange={(e) => setLinkTarget(e.target.value)}
            style={{ ...inputStyle, width: 'auto' }}
          >
            <option value="_self">当前窗口</option>
            <option value="_blank">新窗口</option>
            <option value="_parent">父窗口</option>
            <option value="_top">顶层窗口</option>
          </select>
        </label>
        <button onClick={handleSaveLink} disabled={!link} style={btnStyle(link)}>
          应用链接
        </button>
      </div>

      {/* Tooltip */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>提示文本 (tooltip)</span>
        <input
          type="text"
          placeholder="鼠标悬停提示"
          value={tooltip}
          onChange={(e) => setTooltip(e.target.value)}
          style={inputStyle}
        />
        <button onClick={handleSaveTooltip} disabled={!tooltip} style={btnStyle(tooltip)}>
          应用提示
        </button>
      </div>

      {/* Callback */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>回调函数 (call)</span>
        <input
          type="text"
          placeholder="callbackFunctionName"
          value={functionName}
          onChange={(e) => setFunctionName(e.target.value)}
          style={inputStyle}
        />
        <button onClick={handleSaveCallback} disabled={!functionName} style={btnStyle(functionName)}>
          应用回调
        </button>
      </div>

      {/* 清除按钮 */}
      {clickEvent && (
        <button
          onClick={() => onClear(nodeId)}
          style={{
            padding: '4px 12px',
            border: '1px solid #ff4d4f',
            borderRadius: '4px',
            backgroundColor: '#fff',
            color: '#ff4d4f',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          清除所有交互
        </button>
      )}
    </div>
  );
});

// ============================================================
// 辅助
// ============================================================

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #d9d9d9',
  borderRadius: '4px',
  fontSize: '13px',
};

function btnStyle(enabled: string): React.CSSProperties {
  return {
    padding: '4px 12px',
    border: '1px solid #1890ff',
    borderRadius: '4px',
    backgroundColor: enabled ? '#1890ff' : '#fff',
    color: enabled ? '#fff' : '#999',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: '13px',
  };
}
