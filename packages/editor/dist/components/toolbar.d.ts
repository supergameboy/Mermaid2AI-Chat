/** 工具栏 — 方向切换 + 导出 */
import type { FlowchartDirection } from '@mermaid-editor/serializer';
interface ToolbarProps {
    direction: FlowchartDirection;
    onDirectionChange: (dir: FlowchartDirection) => void;
    mermaidCode: string;
}
export declare function Toolbar({ direction, onDirectionChange, mermaidCode }: ToolbarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=toolbar.d.ts.map