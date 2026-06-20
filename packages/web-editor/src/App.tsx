/**
 * Mermaid2AIChat — Web 编辑器入口
 *
 * 职责：WebSocket 连接 + 状态管理，画布 UI 由 @mermaid2aichat/editor 提供
 *
 * 数据流：
 * - 本地操作：Canvas → onCanvasEdit → sendCanvasEdit → WebSocket → 服务端
 * - 服务端同步：WebSocket → store → Canvas syncNodes/syncEdges
 * - 视图操作：TabBar → sendSwitchView 等 → WebSocket → 服务端 → 广播 → store 更新
 */
import { useCallback } from 'react';
import { Canvas, TabBar } from '@mermaid2aichat/editor';
import type { CanvasSnapshot, ConnectionStatusType } from '@mermaid2aichat/editor';
import type { Viewport } from '@mermaid2aichat/serializer';
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
    sendResetConsumed,
    sendViewportEdit,
    sendSwitchView,
    sendCreateView,
    sendCloseView,
    sendRenameView,
    sendReorderViews,
  } = useWebSocket(buildWsUrl());

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
        syncNodes={store.nodes}
        syncEdges={store.edges}
        syncDirection={store.direction}
        syncViewport={store.viewport}
        consumed={store.consumed}
        canvasSource={store.canvasSource}
        lastConsumedAt={store.lastConsumedAt}
        connectionStatus={status as ConnectionStatusType}
        onCanvasEdit={handleCanvasEdit}
        onDirectionChange={handleDirectionChange}
        onResetConsumed={handleResetConsumed}
        onViewportChange={handleViewportChange}
      />
    </div>
  );
}
