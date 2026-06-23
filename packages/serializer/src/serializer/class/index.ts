/**
 * class 序列化器入口
 *
 * 统一导出 class 序列化相关的公共 API
 *
 * 注意: style-serializer 的函数使用别名导出，避免与 flowchart 的 style-serializer 同名函数冲突
 */

export { serializeClass } from './class-serializer.js';
export { serializeClassNode } from './class-node-serializer.js';
export { serializeRelation } from './relation-serializer.js';
export { serializeNamespace } from './namespace-serializer.js';
export { serializeNotes } from './note-serializer.js';
export {
  serializeClassDefs as serializeClassStyleDefs,
  serializeClassApplications as serializeClassStyleApplications,
  serializeNodeStyles as serializeClassNodeStyles,
} from './style-serializer.js';
