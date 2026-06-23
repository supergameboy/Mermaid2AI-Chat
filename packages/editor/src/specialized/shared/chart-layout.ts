/**
 * 图表布局辅助函数 — 数据图表专用渲染器共用
 *
 * 单一职责：提供坐标转换、比例计算等纯函数辅助
 * 不包含 React 组件，仅提供数学计算
 */

/** 计算线性比例函数 */
export function createLinearScale(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): (value: number) => number {
  if (domainMin === domainMax) {
    return () => (rangeMin + rangeMax) / 2;
  }
  const slope = (rangeMax - rangeMin) / (domainMax - domainMin);
  return (value: number) => rangeMin + (value - domainMin) * slope;
}

/** 将极坐标转换为笛卡尔坐标（SVG 坐标系，Y 向下） */
export function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = (angleInDegrees - 90) * (Math.PI / 180);
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

/** 生成 SVG 饼图扇形 path（从 startAngle 到 endAngle） */
export function describePieSlice(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    `M ${centerX} ${centerY}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

/** 计算饼图扇形中心角度（用于标签定位） */
export function pieSliceMidAngle(startAngle: number, endAngle: number): number {
  return (startAngle + endAngle) / 2;
}

/** 格式化日期为短显示（YYYY-MM-DD） */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  // 仅取 YYYY-MM-DD 部分
  return dateStr.slice(0, 10);
}

/** 计算两个日期之间的天数差 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/** 解析持续时间字符串为天数（支持 "7d", "2w", "1m" 等） */
export function parseDurationToDays(duration: string): number {
  const match = duration.match(/^(\d+)([dwm])?$/);
  if (!match) return 1;
  const value = parseInt(match[1], 10);
  const unit = match[2] ?? 'd';
  switch (unit) {
    case 'd': return value;
    case 'w': return value * 7;
    case 'm': return value * 30;
    default: return value;
  }
}

/** 生成唯一 ID（用于新增数据项） */
export function generateChartId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
