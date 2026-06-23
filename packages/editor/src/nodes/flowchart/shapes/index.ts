/**
 * 形状注册表入口
 *
 * 导出形状组件、路径生成器和注册表
 */

export { ShapeRenderer, handleStyle } from './shape-component.js';
export type { ShapeComponentProps } from './shape-component.js';
export {
  shapeRegistry,
  getShapeDefinition,
  isShapeSupported,
} from './path-generators.js';
export type { PathGenerator, ShapeDefinition, ShapeDecoration } from './path-generators.js';
