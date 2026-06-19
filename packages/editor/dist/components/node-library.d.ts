/** 节点库 — 14种形状，点击添加到画布 */
import type { MermaidShapeType } from '@mermaid-editor/serializer';
interface NodeLibraryProps {
    onAddNode: (shape: MermaidShapeType) => void;
}
export declare function NodeLibrary({ onAddNode }: NodeLibraryProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=node-library.d.ts.map