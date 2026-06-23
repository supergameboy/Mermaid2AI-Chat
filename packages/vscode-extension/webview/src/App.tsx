/**
 * Mermaid2AIChat — VSCode Webview 应用
 *
 * 职责：接收 Extension 转发的服务端状态，渲染 Canvas + TabBar，将用户编辑转发给 Extension
 *
 * 数据流：
 * - 服务端 → Extension → postMessage → Canvas/TabBar 同步
 * - Canvas/TabBar 操作 → postMessage → Extension → WebSocket → 服务端
 * - 图表类型切换：Toolbar/CodeEditor → onDiagramTypeChange → 弹窗确认 → 构造新 CanvasState → postMessage
 *
 * 多图表类型：
 * - activeCanvas 为唯一真相源（CanvasState 联合类型）
 * - nodes/edges/direction 为图结构类型的派生字段
 */
import { useCallback, useEffect, useState } from 'react';
import { Canvas, TabBar, TypeSwitchDialog } from '@mermaid2aichat/editor';
import type { CanvasSnapshot, ConnectionStatusType } from '@mermaid2aichat/editor';
import '@mermaid2aichat/editor/styles.css';
import type {
  CanvasSource,
  CanvasState,
  DiagramType,
  FlowchartDirection,
  MermaidEdge,
  MermaidNode,
  Viewport,
  ViewSummary,
} from '@mermaid2aichat/serializer';
import {
  isGraphCanvasState,
  migrateCanvasState,
  createEmptyCanvasState,
} from '@mermaid2aichat/serializer';

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
  type: 'canvas_update' | 'consumed_update' | 'viewport_update' | 'views_update' | 'active_view_update' | 'reconnect_sync' | 'connection_status';
  payload: unknown;
}

interface ConsumedPayload {
  consumed: boolean;
  lastConsumedAt: number | null;
  canvasSource: CanvasSource;
}

interface ViewportPayload {
  viewport: Viewport;
}

interface ViewsUpdatePayload {
  views: ViewSummary[];
  activeViewId: string | null;
}

interface ActiveViewPayload {
  viewId: string;
  canvas: CanvasState;
  consumed: ConsumedPayload;
  viewport: Viewport;
  title: string | null;
}

interface ReconnectSyncPayload {
  views: ViewSummary[];
  activeViewId: string | null;
  activeView: ActiveViewPayload | null;
}

/** 从 CanvasState 派生图结构字段 */
function deriveGraphFields(canvas: CanvasState): {
  nodes: MermaidNode[];
  edges: MermaidEdge[];
  direction: FlowchartDirection;
} {
  if (isGraphCanvasState(canvas)) {
    return {
      nodes: canvas.nodes,
      edges: canvas.edges,
      direction: canvas.direction ?? 'TD',
    };
  }
  return { nodes: [], edges: [], direction: 'TD' };
}

function createDefaultCanvas(): CanvasState {
  return { diagramType: 'flowchart', nodes: [], edges: [], direction: 'TD' };
}

export default function App() {
  // 视图列表
  const [views, setViews] = useState<ViewSummary[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  // 活动视图内容（activeCanvas 为唯一真相源）
  const [activeCanvas, setActiveCanvas] = useState<CanvasState>(createDefaultCanvas());
  // 图结构类型派生字段
  const [nodes, setNodes] = useState<MermaidNode[]>([]);
  const [edges, setEdges] = useState<MermaidEdge[]>([]);
  const [direction, setDirection] = useState<FlowchartDirection>('TD');
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [consumed, setConsumed] = useState(false);
  const [lastConsumedAt, setLastConsumedAt] = useState<number | null>(null);
  const [canvasSource, setCanvasSource] = useState<CanvasSource>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');
  // 图表类型切换弹窗状态
  const [pendingTypeSwitch, setPendingTypeSwitch] = useState<DiagramType | null>(null);

  /** 更新活动画布并派生图结构字段 */
  const updateActiveCanvas = useCallback((canvas: CanvasState) => {
    const migrated = migrateCanvasState(canvas);
    setActiveCanvas(migrated);
    const derived = deriveGraphFields(migrated);
    setNodes(derived.nodes);
    setEdges(derived.edges);
    setDirection(derived.direction);
  }, []);

  // 接收 Extension 消息
  useEffect(() => {
    // 通知 extension：webview 已挂载，可以发送初始状态
    // 解决竞态条件：sendCurrentState 在 webview 挂载前调用会导致消息丢失
    window.vscode?.postMessage({ type: 'ready' });

    const handler = (event: MessageEvent) => {
      const msg = event.data as ExtensionMessage;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'canvas_update': {
          // 服务端画布更新（联合类型 CanvasState）
          updateActiveCanvas(msg.payload as CanvasState);
          break;
        }
        case 'consumed_update': {
          const payload = msg.payload as ConsumedPayload;
          setConsumed(payload.consumed);
          setLastConsumedAt(payload.lastConsumedAt);
          setCanvasSource(payload.canvasSource);
          break;
        }
        case 'viewport_update': {
          const payload = msg.payload as ViewportPayload;
          setViewport(payload.viewport);
          break;
        }
        case 'views_update': {
          const payload = msg.payload as ViewsUpdatePayload;
          setViews(payload.views);
          setActiveViewId(payload.activeViewId);
          break;
        }
        case 'active_view_update': {
          const payload = msg.payload as ActiveViewPayload;
          setActiveViewId(payload.viewId);
          updateActiveCanvas(payload.canvas);
          setConsumed(payload.consumed.consumed);
          setLastConsumedAt(payload.consumed.lastConsumedAt);
          setCanvasSource(payload.consumed.canvasSource);
          setViewport(payload.viewport);
          break;
        }
        case 'reconnect_sync': {
          const payload = msg.payload as ReconnectSyncPayload;
          setViews(payload.views);
          setActiveViewId(payload.activeViewId);
          if (payload.activeView) {
            const av = payload.activeView;
            setActiveViewId(av.viewId);
            updateActiveCanvas(av.canvas);
            setConsumed(av.consumed.consumed);
            setLastConsumedAt(av.consumed.lastConsumedAt);
            setCanvasSource(av.consumed.canvasSource);
            setViewport(av.viewport);
          }
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
  }, [updateActiveCanvas]);

  // === Canvas 编辑 → 发送给 Extension ===
  const handleCanvasEdit = useCallback(
    (canvas: CanvasSnapshot) => {
      // 图结构类型：从 activeCanvas 构造完整 CanvasState 发送
      const fullCanvas: CanvasState = {
        ...activeCanvas,
        nodes: canvas.nodes,
        edges: canvas.edges,
        direction: canvas.direction,
      };
      window.vscode?.postMessage({
        type: 'canvas_edit',
        payload: fullCanvas,
      });
    },
    [activeCanvas]
  );

  const handleDirectionChange = useCallback(
    (dir: FlowchartDirection) => {
      setDirection(dir);
    },
    []
  );

  const handleResetConsumed = useCallback(() => {
    setConsumed(false);
    window.vscode?.postMessage({
      type: 'reset_consumed',
    });
  }, []);

  const handleViewportChange = useCallback(
    (vp: Viewport) => {
      window.vscode?.postMessage({
        type: 'viewport_edit',
        payload: { viewport: vp },
      });
    },
    []
  );

  // === 数据图表类型更新回调 → 发送给 Extension ===
  const handleCanvasUpdate = useCallback((canvas: CanvasState) => {
    // 同步本地 state
    updateActiveCanvas(canvas);
    window.vscode?.postMessage({
      type: 'canvas_update',
      payload: canvas,
    });
  }, [updateActiveCanvas]);

  // === 图表类型切换回调 → 弹出确认弹窗 ===
  const handleDiagramTypeChange = useCallback((newType: DiagramType) => {
    setPendingTypeSwitch(newType);
  }, []);

  // 弹窗确认 → 清空画布并切换到新类型
  const handleTypeSwitchConfirm = useCallback(() => {
    if (!pendingTypeSwitch) return;
    const newCanvas = createEmptyCanvasState(pendingTypeSwitch);
    // 同步本地 state + 发送到 Extension
    updateActiveCanvas(newCanvas);
    window.vscode?.postMessage({
      type: 'canvas_update',
      payload: newCanvas,
    });
    setPendingTypeSwitch(null);
  }, [pendingTypeSwitch, updateActiveCanvas]);

  // 弹窗取消
  const handleTypeSwitchCancel = useCallback(() => {
    setPendingTypeSwitch(null);
  }, []);

  // === TabBar 视图操作 → 发送给 Extension ===
  const handleSwitchView = useCallback((viewId: string) => {
    window.vscode?.postMessage({
      type: 'switch_view',
      viewId,
    });
  }, []);

  const handleCreateView = useCallback(() => {
    window.vscode?.postMessage({
      type: 'create_view',
    });
  }, []);

  const handleCloseView = useCallback((viewId: string) => {
    window.vscode?.postMessage({
      type: 'close_view',
      viewId,
    });
  }, []);

  const handleRenameView = useCallback((viewId: string, title: string) => {
    window.vscode?.postMessage({
      type: 'rename_view',
      viewId,
      title,
    });
  }, []);

  const handleReorderViews = useCallback((orderedIds: string[]) => {
    window.vscode?.postMessage({
      type: 'reorder_views',
      orderedIds,
    });
  }, []);

  return (
    <div className="app-container">
      <TabBar
        views={views}
        activeViewId={activeViewId}
        onSwitchView={handleSwitchView}
        onCreateView={handleCreateView}
        onCloseView={handleCloseView}
        onRenameView={handleRenameView}
        onReorderViews={handleReorderViews}
      />
      <Canvas
        syncCanvas={activeCanvas}
        syncNodes={nodes}
        syncEdges={edges}
        syncDirection={direction}
        syncViewport={viewport}
        consumed={consumed}
        canvasSource={canvasSource}
        lastConsumedAt={lastConsumedAt}
        connectionStatus={connectionStatus}
        onCanvasEdit={handleCanvasEdit}
        onCanvasUpdate={handleCanvasUpdate}
        onDirectionChange={handleDirectionChange}
        onResetConsumed={handleResetConsumed}
        onViewportChange={handleViewportChange}
        onDiagramTypeChange={handleDiagramTypeChange}
      />
      {pendingTypeSwitch && (
        <TypeSwitchDialog
          currentType={activeCanvas.diagramType}
          newType={pendingTypeSwitch}
          onConfirm={handleTypeSwitchConfirm}
          onCancel={handleTypeSwitchCancel}
        />
      )}
    </div>
  );
}
