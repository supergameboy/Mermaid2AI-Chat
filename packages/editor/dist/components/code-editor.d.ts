interface CodeEditorProps {
    /** Mermaid 代码（由 Canvas 序列化后传入） */
    code: string;
    /** 应用代码回调（用户点击"应用"时触发，外部负责解析并更新画布） */
    onApply: (code: string) => void;
}
export declare function CodeEditor({ code, onApply }: CodeEditorProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=code-editor.d.ts.map