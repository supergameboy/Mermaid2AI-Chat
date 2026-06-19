/**
 * Mermaid 反向编辑器 — Web 编辑器入口
 *
 * 职责：WebSocket 连接 + 状态管理，画布 UI 由 @mermaid-editor/editor 提供
 *
 * 数据流：
 * - 本地操作：Canvas → onCanvasEdit → sendCanvasEdit → WebSocket → 服务端
 * - 服务端同步：WebSocket → store → Canvas syncNodes/syncEdges
 */
import { useCallback } from 'react';
import { Canvas } from '@mermaid-editor/editor';
import type { CanvasSnapshot, ConnectionStatusType } from '@mermaid-editor/editor';
import type { Viewport } from '@mermaid-editor/serializer';
import '@mermaid-editor/editor/styles.css';

import { useEditorStore } from './store.js';
import { useWebSocket } from './hooks/use-websocket.js';

export default function App() {
  const store = useEditorStore();
  const { status, sendCanvasEdit, sendResetConsumed, sendViewportEdit } = useWebSocket();

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
  );
}
