import { describe, it, expect } from 'vitest';
import { sanitizeValue, getSelector } from '../utils/sanitize';

describe('sanitizeValue', () => {
  describe('primitive values', () => {
    it('returns null as-is', () => {
      expect(sanitizeValue(null)).toBe(null);
    });

    it('returns undefined as-is', () => {
      expect(sanitizeValue(undefined)).toBe(undefined);
    });

    it('returns numbers as-is', () => {
      expect(sanitizeValue(42)).toBe(42);
      expect(sanitizeValue(3.14)).toBe(3.14);
      expect(sanitizeValue(-100)).toBe(-100);
    });

    it('returns booleans as-is', () => {
      expect(sanitizeValue(true)).toBe(true);
      expect(sanitizeValue(false)).toBe(false);
    });

    it('returns short strings as-is', () => {
      expect(sanitizeValue('hello')).toBe('hello');
    });

    it('truncates long strings', () => {
      const longString = 'a'.repeat(600);
      const result = sanitizeValue(longString) as string;
      expect(result.length).toBe(503);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('functions', () => {
    it('returns function representation with name', () => {
      function myFunction() {}
      expect(sanitizeValue(myFunction)).toBe('[Function: myFunction]');
    });

    it('returns function representation for anonymous', () => {
      expect(sanitizeValue(() => {})).toBe('[Function: anonymous]');
    });
  });

  describe('symbols', () => {
    it('returns symbol representation', () => {
      const sym = Symbol('test');
      expect(sanitizeValue(sym)).toBe('[Symbol: test]');
    });

    it('handles symbol without description', () => {
      const sym = Symbol();
      expect(sanitizeValue(sym)).toBe('[Symbol: ]');
    });
  });

  describe('arrays', () => {
    it('returns small arrays with sanitized elements', () => {
      const result = sanitizeValue([1, 'two', true]);
      expect(result).toEqual([1, 'two', true]);
    });

    it('returns placeholder for large arrays', () => {
      const largeArray = new Array(100).fill(1);
      expect(sanitizeValue(largeArray)).toBe('[Array(100)]');
    });

    it('handles nested arrays', () => {
      const result = sanitizeValue([[1, 2], [3, 4]]);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });
  });

  describe('objects', () => {
    it('returns sanitized object', () => {
      const result = sanitizeValue({ a: 1, b: 'two' });
      expect(result).toEqual({ a: 1, b: 'two' });
    });

    it('handles React elements', () => {
      const reactElement = { $$typeof: Symbol.for('react.element') };
      expect(sanitizeValue(reactElement)).toBe('[React Element]');
    });

    it('handles Date objects', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(sanitizeValue(date)).toBe('2024-01-01T00:00:00.000Z');
    });

    it('handles RegExp objects', () => {
      const regex = /test/gi;
      expect(sanitizeValue(regex)).toBe('/test/gi');
    });

    it('handles Map objects', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(sanitizeValue(map)).toBe('[Map(2)]');
    });

    it('handles Set objects', () => {
      const set = new Set([1, 2, 3]);
      expect(sanitizeValue(set)).toBe('[Set(3)]');
    });

    it('handles Error objects', () => {
      const error = new Error('test error');
      expect(sanitizeValue(error)).toBe('[Error: test error]');
    });

    it('handles Promise objects', () => {
      const promise = Promise.resolve();
      expect(sanitizeValue(promise)).toBe('[Promise]');
    });

    it('truncates objects with many keys', () => {
      const obj: Record<string, number> = {};
      for (let i = 0; i < 50; i++) {
        obj[`key${i}`] = i;
      }
      const result = sanitizeValue(obj) as Record<string, unknown>;
      expect(Object.keys(result).length).toBe(31);
      expect(result['...']).toBe('[20 more keys]');
    });
  });

  describe('depth limiting', () => {
    it('returns placeholder at max depth', () => {
      const deepObject = { a: { b: { c: { d: { e: { f: 'deep' } } } } } };
      const result = sanitizeValue(deepObject) as any;
      expect(result.a.b.c.d.e.f).toBe('[Max depth]');
    });
  });
});

describe('getSelector', () => {
  it('returns unknown for null', () => {
    expect(getSelector(null)).toBe('unknown');
  });

  it('returns id selector when element has id', () => {
    const element = document.createElement('div');
    element.id = 'myId';
    expect(getSelector(element)).toBe('#myId');
  });

  it('returns tag with classes', () => {
    const element = document.createElement('div');
    element.className = 'class1 class2 class3';
    expect(getSelector(element)).toBe('div.class1.class2');
  });

  it('returns just tag when no id or classes', () => {
    const element = document.createElement('span');
    expect(getSelector(element)).toBe('span');
  });

  it('handles empty className', () => {
    const element = document.createElement('div');
    element.className = '';
    expect(getSelector(element)).toBe('div');
  });

  it('handles whitespace-only className', () => {
    const element = document.createElement('div');
    element.className = '   ';
    expect(getSelector(element)).toBe('div');
  });
});
