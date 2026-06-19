/** 消费状态徽章 — 显示画布消费状态和重新启用按钮 */
import type { CanvasSource } from '@mermaid-editor/serializer';
interface ConsumedBadgeProps {
    consumed: boolean;
    canvasSource: CanvasSource;
    lastConsumedAt: number | null;
    onReset: () => void;
}
export declare function ConsumedBadge({ consumed, canvasSource, lastConsumedAt, onReset }: ConsumedBadgeProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=consumed-badge.d.ts.map