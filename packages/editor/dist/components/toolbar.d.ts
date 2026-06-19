import type { FlowchartDirection } from '@mermaid-editor/serializer';
interface ToolbarProps {
    direction: FlowchartDirection;
    onDirectionChange: (dir: FlowchartDirection) => void;
    mermaidCode: string;
    onImport: (mermaid: string) => void;
}
export declare function Toolbar({ direction, onDirectionChange, mermaidCode, onImport }: ToolbarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=toolbar.d.ts.map