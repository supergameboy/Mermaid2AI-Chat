/**
 * Mermaid 反向编辑器 — VSCode Webview 应用
 *
 * 职责：接收 Extension 转发的服务端状态，渲染 Canvas，将用户编辑转发给 Extension
 *
 * 数据流：
 * - 服务端 → Extension → postMessage → Canvas syncNodes/syncEdges
 * - Canvas onCanvasEdit → postMessage → Extension → WebSocket → 服务端
 */
import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@mermaid-editor/editor';
import type { CanvasSnapshot, ConnectionStatusType } from '@mermaid-editor/editor';
import '@mermaid-editor/editor/styles.css';
import type {
  CanvasSource,
  FlowchartDirection,
  MermaidEdge,
  MermaidNode,
  Viewport,
} from '@mermaid-editor/serializer';

// === VSCode API（由 Extension 注入到 window.vscode） ===
declare global {
  interface Window {
    vscode?: {
      postMessage: (msg: unknown) => void;
    };
  }
}

// === Extension → Webview 消息类型 ===
interface ExtensionMessage {
  type: 'canvas_update' | 'consumed_update' | 'create_view' | 'reconnect_sync' | 'connection_status' | 'viewport_update';
  payload: unknown;
}

interface CanvasPayload {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
}

interface ConsumedPayload {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
}

interface ViewportPayload {
  viewport: Viewport;
}

interface ReconnectSyncPayload {
  canvas: CanvasPayload;
  consumed: ConsumedPayload;
  title: string | null;
  viewport: Viewport;
}

export default function App() {
  const [nodes, setNodes] = useState<MermaidNode[]>([]);
  const [edges, setEdges] = useState<MermaidEdge[]>([]);
  const [direction, setDirection] = useState<FlowchartDirection>('TD');
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [consumed, setConsumed] = useState(false);
  const [lastConsumedAt, setLastConsumedAt] = useState<number | null>(null);
  const [canvasSource, setCanvasSource] = useState<CanvasSource>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');

  // 接收 Extension 消息
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionMessage;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'canvas_update': {
          const payload = msg.payload as CanvasPayload;
          setNodes(payload.nodes);
          setEdges(payload.edges);
          setDirection(payload.direction);
          break;
        }
        case 'consumed_update': {
          const payload = msg.payload as ConsumedPayload;
          setConsumed(payload.consumed);
          setLastConsumedAt(payload.lastConsumedAt);
          setCanvasSource(payload.canvasSource);
          break;
        }
        case 'create_view': {
          // create_view 的画布数据已通过 canvas_update 同步，这里无需额外处理
          break;
        }
        case 'viewport_update': {
          const payload = msg.payload as ViewportPayload;
          setViewport(payload.viewport);
          break;
        }
        case 'reconnect_sync': {
          const payload = msg.payload as ReconnectSyncPayload;
          setNodes(payload.canvas.nodes);
          setEdges(payload.canvas.edges);
          setDirection(payload.canvas.direction);
          setConsumed(payload.consumed.consumed);
          setLastConsumedAt(payload.consumed.lastConsumedAt);
          setCanvasSource(payload.consumed.canvasSource);
          setViewport(payload.viewport);
          break;
        }
        case 'connection_status': {
          setConnectionStatus(msg.payload as ConnectionStatusType);
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Canvas 编辑 → 发送给 Extension
  const handleCanvasEdit = useCallback(
    (canvas: CanvasSnapshot) => {
      window.vscode?.postMessage({
        type: 'canvas_edit',
        payload: canvas,
      });
    },
    []
  );

  // 方向变化
  const handleDirectionChange = useCallback(
    (dir: FlowchartDirection) => {
      setDirection(dir);
    },
    []
  );

  // 重置消费状态
  const handleResetConsumed = useCallback(() => {
    setConsumed(false);
    window.vscode?.postMessage({
      type: 'reset_consumed',
    });
  }, []);

  // 视口变化 → 发送给 Extension
  const handleViewportChange = useCallback(
    (vp: Viewport) => {
      window.vscode?.postMessage({
        type: 'viewport_edit',
        payload: { viewport: vp },
      });
    },
    []
  );

  return (
    <Canvas
      syncNodes={nodes}
      syncEdges={edges}
      syncDirection={direction}
      syncViewport={viewport}
      consumed={consumed}
      canvasSource={canvasSource}
      lastConsumedAt={lastConsumedAt}
      connectionStatus={connectionStatus}
      onCanvasEdit={handleCanvasEdit}
      onDirectionChange={handleDirectionChange}
      onResetConsumed={handleResetConsumed}
      onViewportChange={handleViewportChange}
    />
  );
}
