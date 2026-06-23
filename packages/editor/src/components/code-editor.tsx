/**
 * CodeEditor — Mermaid 代码编辑器（可编辑，实时同步画布）
 *
 * 职责：显示当前画布序列化后的 Mermaid 代码，支持用户编辑并提交（失焦或 Ctrl+Enter）
 * M0 增强：
 *   - 空代码处理：清空代码不报错，显示提示
 *   - 图类型识别提示：当代码检测到的类型与当前类型不一致时显示提示
 *   - diagramType 显示：在标题栏显示当前图表类型
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { detectDiagramType, type DiagramType } from '@mermaid2aichat/serializer';

interface CodeEditorProps {
  /** Mermaid 代码（由 Canvas 序列化后传入） */
  code: string;
  /** 代码编辑回调（失焦或 Ctrl+Enter 时触发） */
  onCodeChange?: (code: string) => void;
  /** 解析错误信息（null 表示无错误） */
  error?: string | null;
  /** M0 新增：当前图表类型（用于显示提示） */
  diagramType?: DiagramType;
}

/** 图表类型中文标签 */
const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  flowchart: '流程图',
  sequenceDiagram: '时序图',
  classDiagram: '类图',
  erDiagram: 'ER图',
  stateDiagram: '状态图',
  mindmap: '思维导图',
  architecture: '架构图',
  gantt: '甘特图',
  pie: '饼图',
  timeline: '时间线',
  quadrantChart: '四象限图',
  xychart: '坐标图',
};

export function CodeEditor({ code, onCodeChange, error, diagramType }: CodeEditorProps) {
  const [localCode, setLocalCode] = useState(code || '');
  const [isFocused, setIsFocused] = useState(false);
  const userEditedRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 画布变化 → 代码更新（仅在未聚焦且用户未手动编辑时同步）
  useEffect(() => {
    if (!isFocused && !userEditedRef.current) {
      setLocalCode(code || '');
    }
  }, [code, isFocused]);

  // M0: 基于 localCode 检测图类型（用户编辑时实时检测，避免基于 mermaidCode 永远匹配当前类型）
  const detectedType = useMemo<DiagramType | null>(() => {
    return detectDiagramType(localCode);
  }, [localCode]);

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

  // 类型变更提示（当前类型与检测到的类型不一致时）
  const hasTypeMismatch = detectedType && diagramType && detectedType !== diagramType;
  const typeHint = hasTypeMismatch
    ? `检测到 ${DIAGRAM_TYPE_LABELS[detectedType]}（当前 ${DIAGRAM_TYPE_LABELS[diagramType]}），提交后将切换`
    : null;

  return (
    <div className="code-editor">
      <div className="code-editor-title">
        <span>Mermaid 代码</span>
        {diagramType && (
          <span className="code-editor-type-badge">{DIAGRAM_TYPE_LABELS[diagramType]}</span>
        )}
      </div>
      <textarea
        ref={textareaRef}
        className="code-editor-content"
        value={localCode}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        placeholder="输入 Mermaid 代码（清空将清空画布）"
      />
      {typeHint && <div className="code-editor-hint">{typeHint}</div>}
      {error && <div className="code-editor-error">{error}</div>}
    </div>
  );
}
