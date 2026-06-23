/**
 * GanttConfigPanel — Gantt 图表配置面板
 *
 * 单一职责：编辑 GanttCanvasState 的图表级配置（日期格式、坐标轴、排除/包含日期等）
 *
 * 数据流:
 *   GanttCanvasState → GanttConfigPanel → onChange(Partial<GanttCanvasState>) → 更新 CanvasState
 *
 * 字段约定（对应官方 gantt 配置语法）:
 *   - dateFormat: string (必填)              — 日期格式（dateFormat 关键字）
 *   - axisFormat?: string                    — 坐标轴日期格式（axisFormat 关键字）
 *   - excludes?: string[]                   — 排除日期（excludes 关键字）
 *   - includes?: string[]                   — 包含日期（includes 关键字）
 *   - todayMarker?: string                  — 今日标记（todayMarker 关键字）
 *   - tickInterval?: string                  — 刻度间隔（tickInterval 关键字）
 *   - weekday?: 'sunday' | 'monday'          — 周起始日（weekday 关键字）
 *   - weekend?: 'friday' | 'saturday'        — 周末日（weekend 关键字）
 *   - inclusiveEndDates?: boolean            — 包含结束日期（inclusiveEndDates 关键字）
 *   - topAxis?: boolean                      — 顶部坐标轴（topAxis 关键字）
 *   - displayMode?: 'compact' | 'regular'    — 显示模式（displayMode 关键字）
 */

import { memo, useState, useEffect } from 'react';
import type { GanttCanvasState } from '@mermaid2aichat/serializer';

// ============================================================
// 类型
// ============================================================

export interface GanttConfigPanelProps {
  /** 当前图表配置 */
  config: GanttCanvasState;
  /** 更新回调，传入部分字段 */
  onChange: (updates: Partial<GanttCanvasState>) => void;
}

// ============================================================
// 组件
// ============================================================

/** Gantt 图表配置面板组件 */
export const GanttConfigPanel = memo(function GanttConfigPanel({
  config,
  onChange,
}: GanttConfigPanelProps) {
  const [excludesText, setExcludesText] = useState((config.excludes ?? []).join(', '));
  const [includesText, setIncludesText] = useState((config.includes ?? []).join(', '));

  // 同步外部更新
  useEffect(() => {
    setExcludesText((config.excludes ?? []).join(', '));
  }, [config.excludes]);

  useEffect(() => {
    setIncludesText((config.includes ?? []).join(', '));
  }, [config.includes]);

  /** 解析逗号分隔的字符串为字符串数组 */
  const parseList = (input: string): string[] =>
    input
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

  /** 提交 excludes 更新 */
  const handleCommitExcludes = () => {
    const list = parseList(excludesText);
    onChange({ excludes: list.length > 0 ? list : undefined });
  };

  /** 提交 includes 更新 */
  const handleCommitIncludes = () => {
    const list = parseList(includesText);
    onChange({ includes: list.length > 0 ? list : undefined });
  };

  return (
    <div className="panel-content">
      {/* dateFormat（必填） */}
      <label className="panel-label">
        日期格式 (dateFormat) *
        <input
          className="panel-input"
          type="text"
          value={config.dateFormat}
          placeholder="如: YYYY-MM-DD"
          onChange={(e) => onChange({ dateFormat: e.target.value })}
        />
      </label>

      {/* axisFormat */}
      <label className="panel-label">
        坐标轴格式 (axisFormat)
        <input
          className="panel-input"
          type="text"
          value={config.axisFormat ?? ''}
          placeholder="如: %Y-%m-%d"
          onChange={(e) => onChange({ axisFormat: e.target.value || undefined })}
        />
      </label>

      {/* tickInterval */}
      <label className="panel-label">
        刻度间隔 (tickInterval)
        <input
          className="panel-input"
          type="text"
          value={config.tickInterval ?? ''}
          placeholder="如: 1day"
          onChange={(e) => onChange({ tickInterval: e.target.value || undefined })}
        />
      </label>

      {/* todayMarker */}
      <label className="panel-label">
        今日标记 (todayMarker)
        <input
          className="panel-input"
          type="text"
          value={config.todayMarker ?? ''}
          placeholder="如: styled,2024-01-01"
          onChange={(e) => onChange({ todayMarker: e.target.value || undefined })}
        />
      </label>

      {/* excludes（逗号分隔，失焦提交） */}
      <label className="panel-label">
        排除日期 (excludes)
        <input
          className="panel-input"
          type="text"
          value={excludesText}
          placeholder="逗号分隔，如: weekends, friday"
          onChange={(e) => setExcludesText(e.target.value)}
          onBlur={handleCommitExcludes}
        />
      </label>

      {/* includes（逗号分隔，失焦提交） */}
      <label className="panel-label">
        包含日期 (includes)
        <input
          className="panel-input"
          type="text"
          value={includesText}
          placeholder="逗号分隔，如: 2024-01-01"
          onChange={(e) => setIncludesText(e.target.value)}
          onBlur={handleCommitIncludes}
        />
      </label>

      {/* weekday */}
      <label className="panel-label">
        周起始日 (weekday)
        <select
          className="panel-select"
          value={config.weekday ?? ''}
          onChange={(e) =>
            onChange({
              weekday: (e.target.value || undefined) as GanttCanvasState['weekday'],
            })
          }
        >
          <option value="">默认</option>
          <option value="sunday">sunday 周日</option>
          <option value="monday">monday 周一</option>
        </select>
      </label>

      {/* weekend */}
      <label className="panel-label">
        周末日 (weekend)
        <select
          className="panel-select"
          value={config.weekend ?? ''}
          onChange={(e) =>
            onChange({
              weekend: (e.target.value || undefined) as GanttCanvasState['weekend'],
            })
          }
        >
          <option value="">默认</option>
          <option value="friday">friday 周五</option>
          <option value="saturday">saturday 周六</option>
        </select>
      </label>

      {/* displayMode */}
      <label className="panel-label">
        显示模式 (displayMode)
        <select
          className="panel-select"
          value={config.displayMode ?? ''}
          onChange={(e) =>
            onChange({
              displayMode: (e.target.value || undefined) as GanttCanvasState['displayMode'],
            })
          }
        >
          <option value="">默认 (regular)</option>
          <option value="regular">regular 常规</option>
          <option value="compact">compact 紧凑</option>
        </select>
      </label>

      {/* inclusiveEndDates */}
      <div className="panel-checkbox-group">
        <label className="panel-checkbox-item">
          <input
            type="checkbox"
            checked={config.inclusiveEndDates ?? false}
            onChange={(e) =>
              onChange({ inclusiveEndDates: e.target.checked || undefined })
            }
          />
          包含结束日期 (inclusiveEndDates)
        </label>

        {/* topAxis */}
        <label className="panel-checkbox-item">
          <input
            type="checkbox"
            checked={config.topAxis ?? false}
            onChange={(e) => onChange({ topAxis: e.target.checked || undefined })}
          />
          顶部坐标轴 (topAxis)
        </label>
      </div>
    </div>
  );
});

GanttConfigPanel.displayName = 'GanttConfigPanel';
