/**
 * er 序列化器入口
 *
 * 统一导出 er 序列化相关的公共 API
 */

export { serializeER } from './er-serializer.js';
export { serializeEntity } from './entity-serializer.js';
export { serializeRelationship, cardinalityToSymbol, identificationToSymbol } from './relationship-serializer.js';
