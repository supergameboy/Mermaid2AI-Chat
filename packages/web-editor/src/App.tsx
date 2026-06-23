/**
 * Mermaid2AIChat — Web 编辑器入口
 *
 * 职责：WebSocket 连接 + 状态管理，画布 UI 由 @mermaid2aichat/editor 提供
 *
 * 数据流：
 * - 本地操作（图结构类型）：Canvas → onCanvasEdit → sendCanvasEdit → WebSocket → 服务端
 * - 本地操作（数据图表类型）：Canvas → onCanvasUpdate → sendCanvasUpdate → WebSocket → 服务端
 * - 服务端同步：WebSocket → store.activeCanvas → Canvas syncCanvas
 * - 视图操作：TabBar → sendSwitchView 等 → WebSocket → 服务端 → 广播 → store 更新
 * - 图表类型切换：Toolbar/CodeEditor → onDiagramTypeChange → 弹窗确认 → 构造新 CanvasState → sendCanvasUpdate
 */
import { useCallback, useState } from 'react';
import { Canvas, TabBar, TypeSwitchDialog } from '@mermaid2aichat/editor';
import type { CanvasSnapshot, ConnectionStatusType } from '@mermaid2aichat/editor';
import type { CanvasState, DiagramType, Viewport } from '@mermaid2aichat/serializer';
import { createEmptyCanvasState } from '@mermaid2aichat/serializer';
import '@mermaid2aichat/editor/styles.css';

import { useEditorStore } from './store.js';
import { useWebSocket } from './hooks/use-websocket.js';

/** 从环境变量获取 workspaceRoot（严格校验，无 fallback） */
function getWorkspaceRoot(): string {
  const root = import.meta.env.VITE_MERMAID_WORKSPACE_ROOT;
  if (!root) {
    throw new Error('VITE_MERMAID_WORKSPACE_ROOT 环境变量未设置');
  }
  return root;
}

/** 构建 WebSocket URL（携带 workspaceRoot 参数） */
function buildWsUrl(): string {
  const root = getWorkspaceRoot();
  return `ws://localhost:14514/ws?workspaceRoot=${encodeURIComponent(root)}`;
}

export default function App() {
  const store = useEditorStore();
  const {
    status,
    sendCanvasEdit,
    sendCanvasUpdate,
    sendResetConsumed,
    sendViewportEdit,
    sendSwitchView,
    sendCreateView,
    sendCloseView,
    sendRenameView,
    sendReorderViews,
  } = useWebSocket(buildWsUrl());

  // 图表类型切换弹窗状态
  const [pendingTypeSwitch, setPendingTypeSwitch] = useState<DiagramType | null>(null);

  const handleCanvasEdit = useCallback(
    (canvas: CanvasSnapshot) => {
      sendCanvasEdit(canvas);
    },
    [sendCanvasEdit]
  );

  const handleDirectionChange = useCallback(
    (dir: typeof store.direction) => {
      store.setDirection(dir);
    },
    [store]
  );

  const handleResetConsumed = useCallback(() => {
    store.resetConsumed();
    sendResetConsumed();
  }, [store, sendResetConsumed]);

  const handleViewportChange = useCallback(
    (viewport: Viewport) => {
      sendViewportEdit(viewport);
    },
    [sendViewportEdit]
  );

  // 数据图表类型更新回调 → 发送 canvas_update 到服务端 + 同步本地 store
  const handleCanvasUpdate = useCallback(
    (canvas: CanvasState) => {
      // 先同步本地 store（数据图表类型全量替换）
      store.setActiveCanvas(canvas);
      // 发送到服务端
      sendCanvasUpdate(canvas);
    },
    [store, sendCanvasUpdate]
  );

  // 图表类型切换回调 → 弹出确认弹窗
  const handleDiagramTypeChange = useCallback((newType: DiagramType) => {
    setPendingTypeSwitch(newType);
  }, []);

  // 弹窗确认 → 清空画布并切换到新类型
  const handleTypeSwitchConfirm = useCallback(() => {
    if (!pendingTypeSwitch) return;
    const newCanvas = createEmptyCanvasState(pendingTypeSwitch);
    // 同步本地 store + 发送到服务端
    store.setActiveCanvas(newCanvas);
    sendCanvasUpdate(newCanvas);
    setPendingTypeSwitch(null);
  }, [pendingTypeSwitch, store, sendCanvasUpdate]);

  // 弹窗取消
  const handleTypeSwitchCancel = useCallback(() => {
    setPendingTypeSwitch(null);
  }, []);

  return (
    <div className="app-container">
      <TabBar
        views={store.views}
        activeViewId={store.activeViewId}
        onSwitchView={sendSwitchView}
        onCreateView={() => sendCreateView()}
        onCloseView={sendCloseView}
        onRenameView={sendRenameView}
        onReorderViews={sendReorderViews}
      />
      <Canvas
        syncCanvas={store.activeCanvas}
        syncNodes={store.nodes}
        syncEdges={store.edges}
        syncDirection={store.direction}
        syncViewport={store.viewport}
        consumed={store.consumed}
        canvasSource={store.canvasSource}
        lastConsumedAt={store.lastConsumedAt}
        connectionStatus={status as ConnectionStatusType}
        onCanvasEdit={handleCanvasEdit}
        onCanvasUpdate={handleCanvasUpdate}
        onDirectionChange={handleDirectionChange}
        onResetConsumed={handleResetConsumed}
        onViewportChange={handleViewportChange}
        onDiagramTypeChange={handleDiagramTypeChange}
      />
      {pendingTypeSwitch && (
        <TypeSwitchDialog
          currentType={store.activeCanvas.diagramType}
          newType={pendingTypeSwitch}
          onConfirm={handleTypeSwitchConfirm}
          onCancel={handleTypeSwitchCancel}
        />
      )}
    </div>
  );
}
