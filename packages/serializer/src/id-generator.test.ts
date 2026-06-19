/**
 * ID 生成器测试 — 26 进制编码、唯一性、register
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { IdGenerator } from './id-generator.js';

describe('IdGenerator', () => {
  let gen: IdGenerator;

  beforeEach(() => {
    gen = new IdGenerator();
  });

  describe('next() — 基本生成', () => {
    it('should generate A as first ID', () => {
      expect(gen.next()).toBe('A');
    });

    it('should generate sequential IDs A, B, C', () => {
      expect(gen.next()).toBe('A');
      expect(gen.next()).toBe('B');
      expect(gen.next()).toBe('C');
    });

    it('should generate Z then AA (26th then 27th)', () => {
      for (let i = 0; i < 25; i++) {
        gen.next();
      }
      expect(gen.next()).toBe('Z');
      expect(gen.next()).toBe('AA');
    });

    it('should generate AB after AA', () => {
      for (let i = 0; i < 26; i++) {
        gen.next();
      }
      expect(gen.next()).toBe('AA');
      expect(gen.next()).toBe('AB');
    });

    it('should generate AZ then BA', () => {
      for (let i = 0; i < 51; i++) {
        gen.next();
      }
      expect(gen.next()).toBe('AZ');
      expect(gen.next()).toBe('BA');
    });
  });

  describe('register() — 预注册 ID', () => {
    it('should skip registered IDs', () => {
      gen.register('A');
      gen.register('B');
      // 第一个未注册的是 C
      expect(gen.next()).toBe('C');
    });

    it('should skip registered IDs across ranges', () => {
      gen.register('A');
      gen.register('AA');
      // A 被注册，下一个是 B
      expect(gen.next()).toBe('B');
    });

    it('should allow registering same ID multiple times (idempotent)', () => {
      gen.register('A');
      gen.register('A');
      expect(gen.next()).toBe('B');
    });
  });

  describe('reset() — 重置', () => {
    it('should reset counter and used IDs', () => {
      gen.next();
      gen.next();
      gen.register('X');
      gen.reset();
      expect(gen.next()).toBe('A');
    });

    it('should allow reusing IDs after reset', () => {
      gen.next();
      gen.reset();
      expect(gen.next()).toBe('A');
    });
  });

  describe('唯一性保证', () => {
    it('should never generate duplicate IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(gen.next());
      }
      expect(ids.size).toBe(100);
    });

    it('should avoid registered IDs in bulk generation', () => {
      gen.register('A');
      gen.register('B');
      gen.register('C');
      const ids = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const id = gen.next();
        expect(id).not.toBe('A');
        expect(id).not.toBe('B');
        expect(id).not.toBe('C');
        ids.add(id);
      }
      expect(ids.size).toBe(50);
    });
  });
});
