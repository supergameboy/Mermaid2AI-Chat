/** 工具栏 — 方向切换 + 连接模式 + 导出 */
import type { FlowchartDirection } from '@mermaid2aichat/serializer';
import type { ConnectionMode } from '../nodes/mermaid-nodes.js';
interface ToolbarProps {
    direction: FlowchartDirection;
    onDirectionChange: (dir: FlowchartDirection) => void;
    mermaidCode: string;
    connectionMode: ConnectionMode;
    onConnectionModeChange: (mode: ConnectionMode) => void;
}
export declare function Toolbar({ direction, onDirectionChange, mermaidCode, connectionMode, onConnectionModeChange }: ToolbarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=toolbar.d.ts.map