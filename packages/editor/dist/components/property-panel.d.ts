/** 属性面板 — 选中节点/边时显示属性编辑 */
import type { MermaidNode, MermaidEdge } from '@mermaid-editor/serializer';
interface PropertyPanelProps {
    selectedNode: MermaidNode | null;
    selectedEdge: MermaidEdge | null;
    onUpdateNode: (id: string, data: Partial<MermaidNode['data']>) => void;
    onUpdateEdge: (id: string, data: Partial<MermaidEdge['data']>) => void;
}
export declare function PropertyPanel({ selectedNode, selectedEdge, onUpdateNode, onUpdateEdge }: PropertyPanelProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=property-panel.d.ts.map