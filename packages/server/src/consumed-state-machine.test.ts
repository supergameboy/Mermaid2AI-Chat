/**
 * 消费状态机测试 — 100% 分支覆盖
 *
 * 覆盖 4 个事件 × 多种初始状态组合
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { consumedReducer, type ConsumedEvent } from './consumed-state-machine.js';
import type { ConsumedState } from '@mermaid-editor/serializer';

describe('consumedReducer', () => {
  const fixedNow = 1700000000000;
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedNow);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  // === 初始状态变体 ===
  const states = {
    fresh: { consumed: false, lastConsumedAt: null, canvasSource: null } as ConsumedState,
    consumedByAi: { consumed: true, lastConsumedAt: 1699000000000, canvasSource: 'ai' as const } as ConsumedState,
    consumedByUser: { consumed: true, lastConsumedAt: 1699000000000, canvasSource: 'user' as const } as ConsumedState,
    reset: { consumed: false, lastConsumedAt: 1699000000000, canvasSource: null } as ConsumedState,
  };

  // === CONSUME 事件 ===
  describe('CONSUME 事件', () => {
    it('should mark as consumed from fresh state', () => {
      const result = consumedReducer(states.fresh, { type: 'CONSUME' });
      expect(result).toEqual({
        consumed: true,
        lastConsumedAt: fixedNow,
        canvasSource: null,
      });
    });

    it('should update lastConsumedAt even if already consumed', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'CONSUME' });
      expect(result.consumed).toBe(true);
      expect(result.lastConsumedAt).toBe(fixedNow);
      expect(result.canvasSource).toBe('ai');
    });

    it('should preserve canvasSource when consuming', () => {
      const result = consumedReducer(states.consumedByUser, { type: 'CONSUME' });
      expect(result.canvasSource).toBe('user');
    });
  });

  // === RESET 事件 ===
  describe('RESET 事件', () => {
    it('should reset consumed to false from consumed state', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'RESET' });
      expect(result.consumed).toBe(false);
    });

    it('should preserve lastConsumedAt on reset', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'RESET' });
      expect(result.lastConsumedAt).toBe(1699000000000);
    });

    it('should preserve canvasSource on reset', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'RESET' });
      expect(result.canvasSource).toBe('ai');
    });

    it('should reset from fresh state without error', () => {
      const result = consumedReducer(states.fresh, { type: 'RESET' });
      expect(result.consumed).toBe(false);
      expect(result.lastConsumedAt).toBeNull();
    });
  });

  // === CANVAS_EDIT 事件（关键修复点）===
  describe('CANVAS_EDIT 事件', () => {
    it('should reset consumed to false when user edits canvas', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'CANVAS_EDIT' });
      expect(result.consumed).toBe(false);
    });

    it('should set canvasSource to user', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'CANVAS_EDIT' });
      expect(result.canvasSource).toBe('user');
    });

    it('should set canvasSource to user even from null source', () => {
      const result = consumedReducer(states.fresh, { type: 'CANVAS_EDIT' });
      expect(result.canvasSource).toBe('user');
    });

    it('should set canvasSource to user even from ai source', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'CANVAS_EDIT' });
      expect(result.canvasSource).toBe('user');
    });

    it('should preserve lastConsumedAt on canvas edit', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'CANVAS_EDIT' });
      expect(result.lastConsumedAt).toBe(1699000000000);
    });

    it('should preserve null lastConsumedAt from fresh state', () => {
      const result = consumedReducer(states.fresh, { type: 'CANVAS_EDIT' });
      expect(result.lastConsumedAt).toBeNull();
    });

    it('should keep consumed false if already false', () => {
      const result = consumedReducer(states.reset, { type: 'CANVAS_EDIT' });
      expect(result.consumed).toBe(false);
      expect(result.canvasSource).toBe('user');
    });
  });

  // === CREATE_VIEW 事件（关键修复点）===
  describe('CREATE_VIEW 事件', () => {
    it('should mark as consumed when AI creates view', () => {
      const result = consumedReducer(states.fresh, { type: 'CREATE_VIEW' });
      expect(result.consumed).toBe(true);
    });

    it('should set canvasSource to ai', () => {
      const result = consumedReducer(states.fresh, { type: 'CREATE_VIEW' });
      expect(result.canvasSource).toBe('ai');
    });

    it('should override user canvasSource with ai', () => {
      const result = consumedReducer(states.consumedByUser, { type: 'CREATE_VIEW' });
      expect(result.canvasSource).toBe('ai');
    });

    it('should update lastConsumedAt to current time', () => {
      const result = consumedReducer(states.fresh, { type: 'CREATE_VIEW' });
      expect(result.lastConsumedAt).toBe(fixedNow);
    });

    it('should override existing lastConsumedAt', () => {
      const result = consumedReducer(states.consumedByAi, { type: 'CREATE_VIEW' });
      expect(result.lastConsumedAt).toBe(fixedNow);
    });
  });

  // === 状态不变性 ===
  describe('状态不变性', () => {
    it('should not mutate original state', () => {
      const original = { ...states.consumedByAi };
      consumedReducer(states.consumedByAi, { type: 'RESET' });
      expect(states.consumedByAi).toEqual(original);
    });

    it('should return a new object each time', () => {
      const state = states.fresh;
      const result = consumedReducer(state, { type: 'CONSUME' });
      expect(result).not.toBe(state);
    });
  });

  // === 完整事件序列 ===
  describe('完整事件序列', () => {
    it('should handle full lifecycle: fresh → CONSUME → CANVAS_EDIT → CONSUME → RESET', () => {
      let state = states.fresh;

      // AI 消费
      state = consumedReducer(state, { type: 'CONSUME' });
      expect(state.consumed).toBe(true);
      expect(state.lastConsumedAt).toBe(fixedNow);

      // 用户编辑画布 → 重置
      state = consumedReducer(state, { type: 'CANVAS_EDIT' });
      expect(state.consumed).toBe(false);
      expect(state.canvasSource).toBe('user');

      // AI 再次消费
      state = consumedReducer(state, { type: 'CONSUME' });
      expect(state.consumed).toBe(true);

      // 用户手动重置
      state = consumedReducer(state, { type: 'RESET' });
      expect(state.consumed).toBe(false);
      expect(state.canvasSource).toBe('user'); // RESET 不改变 canvasSource
    });

    it('should handle AI create_view lifecycle: fresh → CREATE_VIEW → CANVAS_EDIT → CREATE_VIEW', () => {
      let state = states.fresh;

      // AI 创建视图
      state = consumedReducer(state, { type: 'CREATE_VIEW' });
      expect(state.consumed).toBe(true);
      expect(state.canvasSource).toBe('ai');

      // 用户编辑
      state = consumedReducer(state, { type: 'CANVAS_EDIT' });
      expect(state.consumed).toBe(false);
      expect(state.canvasSource).toBe('user');

      // AI 再次创建视图
      state = consumedReducer(state, { type: 'CREATE_VIEW' });
      expect(state.consumed).toBe(true);
      expect(state.canvasSource).toBe('ai');
    });
  });

  // === 所有事件类型覆盖（确保 switch 全分支）===
  describe('所有事件类型覆盖', () => {
    const allEvents: ConsumedEvent[] = [
      { type: 'CONSUME' },
      { type: 'RESET' },
      { type: 'CANVAS_EDIT' },
      { type: 'CREATE_VIEW' },
    ];

    for (const event of allEvents) {
      it(`should handle ${event.type} event from all initial states`, () => {
        for (const stateName of Object.keys(states) as Array<keyof typeof states>) {
          const result = consumedReducer(states[stateName], event);
          expect(result).toBeDefined();
          expect(typeof result.consumed).toBe('boolean');
          expect(['user', 'ai', null]).toContain(result.canvasSource);
        }
      });
    }
  });
});
