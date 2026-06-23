/**
 * TimelineAxis — 甘特图时间轴组件
 *
 * 单一职责：渲染日期刻度 + todayMarker + 排除日着色
 *
 * excludes 支持：
 *   - 'weekends' 关键字（周六周日）
 *   - 具体星期名（'monday'/'tuesday'/.../'sunday'，大小写不敏感）
 *   - 具体日期（YYYY-MM-DD 格式）
 * 与 GanttDB.isInvalidDate 的判断逻辑保持一致
 */

export interface TimelineAxisProps {
  startDate: Date;
  endDate: Date;
  dateFormat: string;
  todayMarker?: string;
  excludes: string[];
  dayWidth: number;
  leftPadding: number;
  topPadding: number;
}

/** 格式化日期为短显示 */
function formatAxisDate(date: Date, dateFormat: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  // 简化：根据 dateFormat 长度决定显示格式
  if (dateFormat.includes('HH') || dateFormat.includes('hh')) {
    return `${m}/${d}`;
  }
  return `${y}-${m}-${d}`;
}

/** 星期名称映射（getDay() 0=周日 ... 6=周六） */
const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/** 判断日期是否被 excludes 排除（与 GanttDB.isInvalidDate 逻辑一致） */
function isExcludedDate(date: Date, excludes: string[]): boolean {
  const day = date.getDay();
  const weekdayName = WEEKDAY_NAMES[day];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  for (const excluded of excludes) {
    const lower = excluded.toLowerCase();
    // 'weekends' 关键字（周六周日）
    if (lower === 'weekends' && (day === 0 || day === 6)) {
      return true;
    }
    // 具体星期名（monday/tuesday/.../sunday）
    if (lower === weekdayName) {
      return true;
    }
    // 具体日期（YYYY-MM-DD）
    if (excluded === dateStr) {
      return true;
    }
  }
  return false;
}

export function TimelineAxis(props: TimelineAxisProps): JSX.Element {
  const {
    startDate,
    endDate,
    dateFormat,
    todayMarker,
    excludes,
    dayWidth,
    leftPadding,
    topPadding,
  } = props;

  const totalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const days: Date[] = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <g>
      {/* 时间轴基线 */}
      <line
        x1={leftPadding}
        y1={topPadding - 20}
        x2={leftPadding + totalDays * dayWidth}
        y2={topPadding - 20}
        stroke="#d9d9d9"
        strokeWidth={1}
      />
      {/* 日期刻度 */}
      {days.map((date, i) => {
        const x = leftPadding + i * dayWidth;
        const isExcluded = isExcludedDate(date, excludes);
        return (
          <g key={i}>
            {/* 周末/排除日背景 */}
            {isExcluded && (
              <rect
                x={x}
                y={topPadding - 20}
                width={dayWidth}
                height={2000}
                fill="#fafafa"
              />
            )}
            {/* 刻度线 */}
            <line
              x1={x}
              y1={topPadding - 24}
              x2={x}
              y2={topPadding - 16}
              stroke="#999"
              strokeWidth={1}
            />
            {/* 日期标签（每7天显示一次，或首日） */}
            {(i % 7 === 0 || i === totalDays) && (
              <text
                x={x}
                y={topPadding - 28}
                fontSize={10}
                fill="#999"
                textAnchor="middle"
              >
                {formatAxisDate(date, dateFormat)}
              </text>
            )}
          </g>
        );
      })}
      {/* todayMarker */}
      {(() => {
        if (todayMarker === 'off' || today < startDate || today > endDate) {
          return null;
        }
        const dayOffset = Math.round(
          (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const todayX = leftPadding + dayOffset * dayWidth;
        const stroke = todayMarker?.startsWith('stroke:')
          ? todayMarker.match(/stroke:(#[0-9a-fA-F]+)/)?.[1] ?? '#f00'
          : '#f00';
        return (
          <line
            x1={todayX}
            y1={topPadding - 20}
            x2={todayX}
            y2={topPadding + 2000}
            stroke={stroke}
            strokeWidth={2}
            strokeDasharray="5,3"
          />
        );
      })()}
    </g>
  );
}
