interface CodeEditorProps {
    /** Mermaid 代码（由 Canvas 序列化后传入） */
    code: string;
    /** 代码编辑回调（失焦或 Ctrl+Enter 时触发） */
    onCodeChange?: (code: string) => void;
    /** 解析错误信息（null 表示无错误） */
    error?: string | null;
}
export declare function CodeEditor({ code, onCodeChange, error }: CodeEditorProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=code-editor.d.ts.map