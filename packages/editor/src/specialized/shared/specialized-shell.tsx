/**
 * SpecializedShell — 数据图表渲染器共用外壳
 *
 * 单一职责：提供工具栏 + 代码编辑器 + 消费徽章 + 连接状态 + 内容区
 * 各专用渲染器只需实现内容区，外壳由本组件统一提供
 *
 * M0 增强：
 *   - CodeEditor 移到右侧面板顶部
 *   - 添加 diagramType 属性（类型检测由 CodeEditor 内部基于 localCode 完成）
 */
import type { ReactNode } from 'react';
import {
  serializeMermaid,
  parseMermaid,
  type CanvasSource,
  type CanvasState,
  type DiagramType,
  type FlowchartDirection,
  type ParseError,
} from '@mermaid2aichat/serializer';
import { useMemo, useState, useCallback } from 'react';
import { Toolbar } from '../../components/toolbar.js';
import { CodeEditor } from '../../components/code-editor.js';
import { ConsumedBadge } from '../../components/consumed-badge.js';
import { ConnectionStatus } from '../../components/connection-status.js';
import type { ConnectionMode } from '../../nodes/index.js';
import type { ConnectionStatusType } from '../../types.js';

interface SpecializedShellProps {
  /** 当前画布状态 */
  syncCanvas: CanvasState;
  /** 消费状态 */
  consumed: boolean;
  /** 画布内容来源 */
  canvasSource: CanvasSource;
  /** 最后消费时间戳 */
  lastConsumedAt: number | null;
  /** WebSocket 连接状态 */
  connectionStatus: ConnectionStatusType;
  /** 画布状态更新回调（用户编辑触发，外部负责发送到服务端） */
  onCanvasUpdate: (canvas: CanvasState) => void;
  /** 重置消费状态回调 */
  onResetConsumed: () => void;
  /** 图表类型切换回调（用户通过 Toolbar 下拉或代码编辑器首行修改触发） */
  onDiagramTypeChange?: (newType: DiagramType) => void;
  /** 内容区（专用渲染器实现） */
  children: ReactNode;
}

export function SpecializedShell(props: SpecializedShellProps) {
  const {
    syncCanvas,
    consumed,
    canvasSource,
    lastConsumedAt,
    connectionStatus,
    onCanvasUpdate,
    onResetConsumed,
    onDiagramTypeChange,
    children,
  } = props;

  const [codeError, setCodeError] = useState<string | null>(null);
  // 数据图表不使用方向/连线模式，提供默认值满足 Toolbar 接口
  const [connectionMode] = useState<ConnectionMode>('direction');
  const [localDirection] = useState<FlowchartDirection>('TD');

  // 序列化当前画布为 Mermaid 代码
  const mermaidCode = useMemo(() => {
    const result = serializeMermaid(syncCanvas);
    return result.mermaid;
  }, [syncCanvas]);

  // 代码编辑：解析 Mermaid → CanvasState → 通知外部
  const handleCodeChange = useCallback(
    (code: string) => {
      // M0: 统一使用 parseMermaid（自动检测图类型，支持空代码）
      const result = parseMermaid(code);
      if (!result.success) {
        setCodeError(result.errors.map((e: ParseError) => e.message).join('; '));
        return;
      }

      // 代码本身就是数据源，无论是否跨类型切换，都直接应用解析结果
      // 不弹窗、不清空 — 用户输入的代码就是想要的内容
      onCanvasUpdate(result.canvas);
      setCodeError(null);
    },
    [onCanvasUpdate]
  );

  return (
    <div className="app-container">
      <Toolbar
        diagramType={syncCanvas.diagramType}
        direction={localDirection}
        mermaidCode={mermaidCode}
        connectionMode={connectionMode}
        onConnectionModeChange={() => {
          // 数据图表不支持连线模式切换
        }}
        onDiagramTypeChange={onDiagramTypeChange}
        onDirectionChange={() => {
          // 数据图表不支持方向切换
        }}
      />

      <div className="main-content">
        <div className="canvas-container specialized-canvas-container">
          {children}

          <ConsumedBadge
            consumed={consumed}
            canvasSource={canvasSource}
            lastConsumedAt={lastConsumedAt}
            onReset={onResetConsumed}
          />

          <ConnectionStatus status={connectionStatus} />
        </div>

        <div className="right-panel">
          <CodeEditor
            code={mermaidCode}
            onCodeChange={handleCodeChange}
            error={codeError}
            diagramType={syncCanvas.diagramType}
          />
        </div>
      </div>
    </div>
  );
}
