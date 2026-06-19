/**
 * CodeEditor — Mermaid 代码编辑器（只读，实时同步画布）
 *
 * 职责：显示当前画布序列化后的 Mermaid 代码，辅助用户查看
 * 设计依据：模块3 L145-191 — 左侧面板上为代码编辑器（辅助），实时同步
 */
interface CodeEditorProps {
  /** Mermaid 代码（由 Canvas 序列化后传入） */
  code: string;
}

export function CodeEditor({ code }: CodeEditorProps) {
  return (
    <div className="code-editor">
      <div className="code-editor-title">Mermaid 代码</div>
      <pre className="code-editor-content">{code || 'flowchart TD'}</pre>
    </div>
  );
}
