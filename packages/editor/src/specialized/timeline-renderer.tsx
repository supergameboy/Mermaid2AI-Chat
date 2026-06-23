/**
 * TimelineRenderer — 时间线渲染器
 *
 * 单一职责：将 TimelineCanvasState 渲染为时间线，提供完整编辑功能
 *
 * 功能:
 * - 水平（LR）/垂直（TB）布局，按 direction 选择
 * - section 虚线框分组（决策 8）
 * - 点击时间段：高亮 + 打开 TimelinePeriodPanel
 * - 点击事件：高亮 + 打开 TimelineEventPanel
 * - 右键时间段：上下文菜单 → 添加事件/删除时间段
 * - 右键事件：上下文菜单 → 删除事件
 * - 右键 section：上下文菜单 → 重命名/删除 section
 * - 右键画布：上下文菜单 → 添加时间段/添加 section
 * - 切换方向按钮：更新 direction（LR/TB）
 *
 * 数据流:
 *   TimelineCanvasState → TimelineRenderer → 时间线 + 编辑面板
 *   用户编辑 → onCanvasUpdate(TimelineCanvasState) → 外部同步
 */

import { useState, useCallback } from 'react';
import type { MouseEvent, ReactElement } from 'react';
import type {
  TimelineCanvasState,
  TimelineEvent,
  TimelinePeriod,
  TimelineSection,
} from '@mermaid2aichat/serializer';
import { SpecializedShell } from './shared/specialized-shell.js';
import type { TimelineRendererProps } from './types.js';
import { SectionGroup } from '../timeline/section-group.js';
import { PeriodNode } from '../timeline/period-node.js';
import { TimelinePeriodPanel } from '../components/timeline/timeline-period-panel.js';
import { TimelineEventPanel } from '../components/timeline/timeline-event-panel.js';
import { TimelineSectionPanel } from '../components/timeline/timeline-section-panel.js';

/** 编辑目标类型 */
type EditTarget =
  | { type: 'period'; sectionIdx: number; periodIdx: number }
  | { type: 'event'; sectionIdx: number; periodIdx: number; eventIdx: number }
  | { type: 'section'; sectionIdx: number };

/** 右键菜单状态 */
interface ContextMenuState {
  x: number;
  y: number;
  /** 右键目标 */
  target:
    | { type: 'canvas' }
    | { type: 'period'; sectionIdx: number; periodIdx: number }
    | { type: 'event'; sectionIdx: number; periodIdx: number; eventIdx: number }
    | { type: 'section'; sectionIdx: number };
}

export function TimelineRenderer(props: TimelineRendererProps): ReactElement {
  const { syncCanvas, onCanvasUpdate, ...shellProps } = props;

  // 编辑目标（选中元素）
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const direction = syncCanvas.direction ?? 'LR';

  // ============================================================
  // 编辑操作
  // ============================================================

  /** 更新时间段 */
  const handleUpdatePeriod = useCallback(
    (sectionIdx: number, periodIdx: number, updates: Partial<TimelinePeriod>) => {
      const newSections = syncCanvas.sections.map((section, si) => {
        if (si !== sectionIdx) return section;
        return {
          ...section,
          periods: section.periods.map((p, pi) =>
            pi === periodIdx ? { ...p, ...updates } : p
          ),
        };
      });
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 更新事件 */
  const handleUpdateEvent = useCallback(
    (sectionIdx: number, periodIdx: number, eventIdx: number, updates: Partial<TimelineEvent>) => {
      const newSections = syncCanvas.sections.map((section, si) => {
        if (si !== sectionIdx) return section;
        return {
          ...section,
          periods: section.periods.map((p, pi) => {
            if (pi !== periodIdx) return p;
            return {
              ...p,
              events: p.events.map((e, ei) =>
                ei === eventIdx ? { ...e, ...updates } : e
              ),
            };
          }),
        };
      });
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 重命名 section */
  const handleRenameSection = useCallback(
    (sectionIdx: number, name: string) => {
      const newSections = syncCanvas.sections.map((section, si) =>
        si === sectionIdx
          ? { ...section, name: name || undefined }
          : section
      );
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 删除时间段 */
  const handleDeletePeriod = useCallback(
    (sectionIdx: number, periodIdx: number) => {
      const newSections = syncCanvas.sections.map((section, si) => {
        if (si !== sectionIdx) return section;
        return {
          ...section,
          periods: section.periods.filter((_, pi) => pi !== periodIdx),
        };
      });
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
      setEditTarget(null);
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 删除事件 */
  const handleDeleteEvent = useCallback(
    (sectionIdx: number, periodIdx: number, eventIdx: number) => {
      const newSections = syncCanvas.sections.map((section, si) => {
        if (si !== sectionIdx) return section;
        return {
          ...section,
          periods: section.periods.map((p, pi) => {
            if (pi !== periodIdx) return p;
            return {
              ...p,
              events: p.events.filter((_, ei) => ei !== eventIdx),
            };
          }),
        };
      });
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
      setEditTarget(null);
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 删除 section */
  const handleDeleteSection = useCallback(
    (sectionIdx: number) => {
      const newSections = syncCanvas.sections.filter((_, si) => si !== sectionIdx);
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
      setEditTarget(null);
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 添加时间段到 section */
  const handleAddPeriod = useCallback(
    (sectionIdx: number) => {
      const newPeriod: TimelinePeriod = {
        label: `时间段 ${syncCanvas.sections[sectionIdx].periods.length + 1}`,
        events: [],
      };
      const newSections = syncCanvas.sections.map((section, si) =>
        si === sectionIdx
          ? { ...section, periods: [...section.periods, newPeriod] }
          : section
      );
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 添加事件到时间段 */
  const handleAddEvent = useCallback(
    (sectionIdx: number, periodIdx: number) => {
      const newEvent: TimelineEvent = { label: '新事件' };
      const newSections = syncCanvas.sections.map((section, si) => {
        if (si !== sectionIdx) return section;
        return {
          ...section,
          periods: section.periods.map((p, pi) =>
            pi === periodIdx ? { ...p, events: [...p.events, newEvent] } : p
          ),
        };
      });
      onCanvasUpdate({ ...syncCanvas, sections: newSections });
    },
    [syncCanvas, onCanvasUpdate]
  );

  /** 添加 section */
  const handleAddSection = useCallback(() => {
    const newSection: TimelineSection = {
      name: `区段 ${syncCanvas.sections.length + 1}`,
      periods: [],
    };
    onCanvasUpdate({ ...syncCanvas, sections: [...syncCanvas.sections, newSection] });
  }, [syncCanvas, onCanvasUpdate]);

  /** 切换方向 */
  const handleToggleDirection = useCallback(() => {
    const newDirection = direction === 'LR' ? 'TB' : 'LR';
    onCanvasUpdate({ ...syncCanvas, direction: newDirection });
  }, [direction, syncCanvas, onCanvasUpdate]);

  // ============================================================
  // 交互处理
  // ============================================================

  /** 点击时间段：打开编辑面板 */
  const handlePeriodClick = useCallback(
    (sectionIdx: number, periodIdx: number) => {
      setEditTarget({ type: 'period', sectionIdx, periodIdx });
      setContextMenu(null);
    },
    []
  );

  /** 点击事件：打开编辑面板 */
  const handleEventClick = useCallback(
    (sectionIdx: number, periodIdx: number, eventIdx: number) => {
      setEditTarget({ type: 'event', sectionIdx, periodIdx, eventIdx });
      setContextMenu(null);
    },
    []
  );

  /** 右键时间段：上下文菜单 */
  const handlePeriodContextMenu = useCallback(
    (e: MouseEvent, sectionIdx: number, periodIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, target: { type: 'period', sectionIdx, periodIdx } });
    },
    []
  );

  /** 右键 section：上下文菜单 */
  const handleSectionContextMenu = useCallback(
    (e: MouseEvent, sectionIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, target: { type: 'section', sectionIdx } });
    },
    []
  );

  /** 右键画布：上下文菜单 */
  const handleCanvasContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, target: { type: 'canvas' } });
  }, []);

  /** 关闭右键菜单 */
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ============================================================
  // 当前编辑目标的数据
  // ============================================================

  const selectedPeriod = editTarget?.type === 'period'
    ? syncCanvas.sections[editTarget.sectionIdx]?.periods[editTarget.periodIdx]
    : null;

  const selectedEvent = editTarget?.type === 'event'
    ? syncCanvas.sections[editTarget.sectionIdx]?.periods[editTarget.periodIdx]?.events[editTarget.eventIdx]
    : null;

  const selectedSection = editTarget?.type === 'section'
    ? syncCanvas.sections[editTarget.sectionIdx]
    : null;

  return (
    <SpecializedShell
      syncCanvas={syncCanvas}
      onCanvasUpdate={onCanvasUpdate}
      {...shellProps}
    >
      <div className="specialized-chart-wrapper">
        <div className="specialized-header">
          <div className="specialized-title">{syncCanvas.title ?? '时间线'}</div>
          <button
            type="button"
            className="toolbar-btn timeline-direction-btn"
            onClick={handleToggleDirection}
            title="切换方向"
          >
            {direction === 'LR' ? '水平 → 垂直' : '垂直 → 水平'}
          </button>
        </div>

        <div
          className={`timeline-container ${direction === 'LR' ? 'horizontal' : 'vertical'}`}
          onContextMenu={handleCanvasContextMenu}
        >
          {/* 主轴线 */}
          <div className="timeline-axis" />

          {syncCanvas.sections.map((section, sectionIdx) => (
            <SectionGroup
              key={sectionIdx}
              section={section}
              direction={direction}
              onContextMenu={(e) => handleSectionContextMenu(e, sectionIdx)}
            >
              {section.periods.map((period, periodIdx) => (
                <PeriodNode
                  key={periodIdx}
                  period={period}
                  direction={direction}
                  isHighlighted={
                    editTarget?.type === 'period' &&
                    editTarget.sectionIdx === sectionIdx &&
                    editTarget.periodIdx === periodIdx
                  }
                  onClick={() => handlePeriodClick(sectionIdx, periodIdx)}
                  onContextMenu={(e) => handlePeriodContextMenu(e, sectionIdx, periodIdx)}
                  onEventClick={(eventIdx) => handleEventClick(sectionIdx, periodIdx, eventIdx)}
                />
              ))}
              <button
                type="button"
                className="toolbar-btn timeline-add-period"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddPeriod(sectionIdx);
                }}
              >
                添加时间段
              </button>
            </SectionGroup>
          ))}

          <button
            type="button"
            className="toolbar-btn timeline-add-section"
            onClick={(e) => {
              e.stopPropagation();
              handleAddSection();
            }}
          >
            添加区段
          </button>
        </div>

        {/* 编辑面板区域 */}
        {selectedPeriod && (
          <div className="specialized-edit-panel">
            <TimelinePeriodPanel
              period={selectedPeriod}
              onChange={(updates) => {
                if (editTarget?.type === 'period') {
                  handleUpdatePeriod(editTarget.sectionIdx, editTarget.periodIdx, updates);
                }
              }}
              onDelete={() => {
                if (editTarget?.type === 'period') {
                  handleDeletePeriod(editTarget.sectionIdx, editTarget.periodIdx);
                }
              }}
            />
          </div>
        )}

        {selectedEvent && (
          <div className="specialized-edit-panel">
            <TimelineEventPanel
              event={selectedEvent}
              onChange={(updates) => {
                if (editTarget?.type === 'event') {
                  handleUpdateEvent(
                    editTarget.sectionIdx,
                    editTarget.periodIdx,
                    editTarget.eventIdx,
                    updates
                  );
                }
              }}
              onDelete={() => {
                if (editTarget?.type === 'event') {
                  handleDeleteEvent(
                    editTarget.sectionIdx,
                    editTarget.periodIdx,
                    editTarget.eventIdx
                  );
                }
              }}
            />
          </div>
        )}

        {selectedSection && (
          <div className="specialized-edit-panel">
            <TimelineSectionPanel
              section={selectedSection}
              onRename={(name) => {
                if (editTarget?.type === 'section') {
                  handleRenameSection(editTarget.sectionIdx, name);
                }
              }}
              onDelete={() => {
                if (editTarget?.type === 'section') {
                  handleDeleteSection(editTarget.sectionIdx);
                }
              }}
            />
          </div>
        )}
      </div>

      {/* 右键上下文菜单 */}
      {contextMenu && (() => {
        const target = contextMenu.target;
        return (
        <>
          {/* 透明遮罩，点击关闭菜单 */}
          <div
            className="context-menu-overlay"
            onClick={handleCloseContextMenu}
            onContextMenu={(e) => { e.preventDefault(); handleCloseContextMenu(); }}
          />
          <div
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {target.type === 'canvas' && (
              <>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    if (syncCanvas.sections.length > 0) {
                      handleAddPeriod(syncCanvas.sections.length - 1);
                    } else {
                      handleAddSection();
                    }
                    setContextMenu(null);
                  }}
                >
                  添加时间段
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    handleAddSection();
                    setContextMenu(null);
                  }}
                >
                  添加区段
                </button>
              </>
            )}

            {target.type === 'period' && (
              <>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    handleAddEvent(target.sectionIdx, target.periodIdx);
                    setContextMenu(null);
                  }}
                >
                  添加事件
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    handleDeletePeriod(target.sectionIdx, target.periodIdx);
                    setContextMenu(null);
                  }}
                >
                  删除时间段
                </button>
              </>
            )}

            {target.type === 'event' && (
              <button
                type="button"
                className="context-menu-item"
                onClick={() => {
                  handleDeleteEvent(
                    target.sectionIdx,
                    target.periodIdx,
                    target.eventIdx
                  );
                  setContextMenu(null);
                }}
              >
                删除事件
              </button>
            )}

            {target.type === 'section' && (
              <>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    setEditTarget({ type: 'section', sectionIdx: target.sectionIdx });
                    setContextMenu(null);
                  }}
                >
                  重命名区段
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    handleAddPeriod(target.sectionIdx);
                    setContextMenu(null);
                  }}
                >
                  添加时间段
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    handleDeleteSection(target.sectionIdx);
                    setContextMenu(null);
                  }}
                >
                  删除区段
                </button>
              </>
            )}
          </div>
        </>
        );
      })()}
    </SpecializedShell>
  );
}
