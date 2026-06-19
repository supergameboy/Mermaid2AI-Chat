/** 工具栏 — 方向切换 */
import type { FlowchartDirection } from '@mermaid-editor/serializer';
interface ToolbarProps {
    direction: FlowchartDirection;
    onDirectionChange: (dir: FlowchartDirection) => void;
}
export declare function Toolbar({ direction, onDirectionChange }: ToolbarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=toolbar.d.ts.map