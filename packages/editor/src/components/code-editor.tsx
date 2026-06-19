/**
 * CodeEditor — Mermaid 代码编辑器（可编辑，实时同步画布）
 *
 * 职责：显示当前画布序列化后的 Mermaid 代码，支持用户编辑并提交（失焦或 Ctrl+Enter）
 * 设计依据：模块3 L145-191 — 左侧面板上为代码编辑器（辅助），实时同步
 */
import { useState, useEffect, useRef } from 'react';

interface CodeEditorProps {
  /** Mermaid 代码（由 Canvas 序列化后传入） */
  code: string;
  /** 代码编辑回调（失焦或 Ctrl+Enter 时触发） */
  onCodeChange?: (code: string) => void;
  /** 解析错误信息（null 表示无错误） */
  error?: string | null;
}

export function CodeEditor({ code, onCodeChange, error }: CodeEditorProps) {
  const [localCode, setLocalCode] = useState(code || 'flowchart TD');
  const [isFocused, setIsFocused] = useState(false);
  const userEditedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 画布变化 → 代码更新（仅在未聚焦且用户未手动编辑时同步）
  useEffect(() => {
    if (!isFocused && !userEditedRef.current) {
      setLocalCode(code || 'flowchart TD');
    }
  }, [code, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    userEditedRef.current = true;
    setLocalCode(e.target.value);
  };

  const handleFocus = () => setIsFocused(true);

  const handleBlur = () => {
    setIsFocused(false);
    if (userEditedRef.current && localCode !== code) {
      onCodeChange?.(localCode);
      userEditedRef.current = false; // 提交后立即重置，允许后续画布变化同步
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (userEditedRef.current && localCode !== code) {
        onCodeChange?.(localCode);
        userEditedRef.current = false; // 提交后立即重置，允许后续画布变化同步
      }
    }
  };

  return (
    <div className="code-editor">
      <div className="code-editor-title">Mermaid 代码</div>
      <textarea
        ref={textareaRef}
        className="code-editor-content"
        value={localCode}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="flowchart TD"
      />
      {error && <div className="code-editor-error">{error}</div>}
    </div>
  );
}
