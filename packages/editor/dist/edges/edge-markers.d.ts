/**
 * 边样式 → 端点 marker 映射（纯函数，不依赖 React Flow）
 *
 * 所有 marker 均使用自定义 SVG defs，不依赖 React Flow MarkerType 枚举，
 * 确保 circle/cross/bidirectional 端点视觉正确且完全可控。
 *
 * Mermaid 边样式对应的端点形状:
 * - arrow/dotted-arrow/thick: 实心箭头 (custom:arrow)
 * - line/dotted: 无端点
 * - circle: 空心圆 (custom:circle) — 对应 mermaid ---o
 * - cross: X 形端点 (custom:cross) — 对应 mermaid ---x
 * - bidirectional: 双向箭头 (两端 custom:arrow) — 对应 mermaid <--->
 *
 * 纯字符串设计：便于单元测试，边组件负责转换为 SVG marker url。
 */
import type { MermaidEdgeStyle } from '@mermaid2aichat/serializer';
/** 端点 marker 配置（纯字符串，与 React Flow 解耦） */
export interface EdgeMarkerConfig {
    /** 结束端点 marker 类型：'custom:arrow' | 'custom:circle' | 'custom:cross' */
    markerEndType?: string;
    /** 起始端点 marker 类型 */
    markerStartType?: string;
}
/**
 * 根据边样式获取端点 marker 配置
 * 未知样式回退到 arrow 配置
 */
export declare function getEdgeMarkerConfig(edgeStyle: MermaidEdgeStyle): EdgeMarkerConfig;
/**
 * 判断 marker 类型是否为自定义类型（需要画布注册 SVG defs）
 */
export declare function isCustomMarker(markerType: string | undefined): boolean;
/**
 * 获取自定义 marker 的 SVG defs id（如 'custom:cross' → 'mermaid-cross-marker'）
 */
export declare function getCustomMarkerId(markerType: string): string;
/**
 * 将 marker 类型字符串转换为 SVG marker url（如 'custom:arrow' → 'url(#mermaid-arrow-marker)'）
 * 无 marker 类型时返回 undefined
 */
export declare function toMarkerUrl(markerType: string | undefined): string | undefined;
//# sourceMappingURL=edge-markers.d.ts.map