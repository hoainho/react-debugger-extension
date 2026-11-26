import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReduxTab } from '../panel/tabs/ReduxTab';
import { chromeMock } from './setup';

describe('ReduxTab search and editing', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    chromeMock.runtime.sendMessage.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function render(state: unknown, detected = true) {
    act(() => root.render(
      <ReduxTab detected={detected} state={state} actions={[]} tabId={7} />
    ));
  }

  function click(element: Element | null) {
    if (!element) throw new Error('Missing click target');
    act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  }

  function input(selector: string, value: string) {
    const element = container.querySelector<HTMLInputElement>(selector);
    if (!element) throw new Error(`Missing input: ${selector}`);
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  function keys() {
    return [...container.querySelectorAll('.json-key')].map(node => node.textContent);
  }

  it('reuses search serialization on unrelated renders and tree expansion', () => {
    const user = { name: 'Alice', role: 'reader' };
    const settings = { theme: 'dark' };
    const state = { user, settings };
    render(state);
    const stringify = vi.spyOn(JSON, 'stringify');
    input('.search-input', 'ALICE');
    expect(keys()).toEqual(['user: ']);
    expect(stringify.mock.calls.filter(([value]) => value === user || value === settings)).toHaveLength(2);

    stringify.mockClear();
    input('input[placeholder="e.g., INCREMENT"]', 'INCREMENT');
    click(container.querySelector('[title="Expand All"]'));
    render(state);

    expect(keys()).toEqual(['user: ', 'name: ', 'role: ']);
    expect(stringify.mock.calls.filter(([value]) => value === user || value === settings)).toHaveLength(0);
  });

  it('updates filtering for new queries and new state and clears the search', () => {
    render({ user: { name: 'Alice' }, settings: { theme: 'dark' } });
    input('.search-input', 'alice');
    expect(keys()).toEqual(['user: ']);
    input('.search-input', 'DARK');
    expect(keys()).toEqual(['settings: ']);
    render({ user: { theme: 'dark' }, settings: { theme: 'light' } });
    expect(keys()).toEqual(['user: ']);
    input('.search-input', '');
    expect(keys()).toEqual(['user: ', 'settings: ']);
    input('.search-input', 'SETTINGS');
    expect(keys()).toEqual(['settings: ']);
  });

  it('does not serialize edit paths when selecting or changing a value', () => {
    render({ count: 1, other: 2 });
    const stringify = vi.spyOn(JSON, 'stringify');
    click(container.querySelector('.json-number'));
    input('input.edit-input', '3');
    expect(container.querySelector<HTMLInputElement>('input.edit-input')?.value).toBe('3');
    expect(stringify.mock.calls.filter(([value]) => Array.isArray(value))).toHaveLength(0);
  });

  it('saves the original nested array edit target', () => {
    render({ users: [{ name: 'Alice' }] });
    click(container.querySelector('[title="Expand All"]'));
    click(container.querySelector('.json-string'));
    input('input.edit-input', 'Bob');
    click(container.querySelector('[title="Save (Enter)"]'));
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'SET_REDUX_STATE',
      tabId: 7,
      payload: { path: ['users', '0', 'name'], value: 'Bob' },
    });
  });

  it('keeps distinct edit targets when a key contains a path delimiter', () => {
    render({ ['a\0b']: 1, a: { b: 2 } });
    click(container.querySelector('[title="Expand All"]'));
    click(container.querySelector('.json-number'));
    expect(container.querySelectorAll('input.edit-input')).toHaveLength(1);
    expect(container.querySelector('.json-number')?.textContent).toBe('2');
  });

  it('keeps hooks stable across detection changes and missing state', () => {
    render(null, false);
    expect(container.textContent).toContain('Redux not detected');
    render({ count: 1 });
    input('.search-input', 'count');
    expect(keys()).toEqual(['count: ']);
    render(undefined);
    expect(container.textContent).toContain('No state available');
    render(null, false);
    expect(container.textContent).toContain('Redux not detected');
  });

  it('preserves unfiltered array roots', () => {
    render([{ name: 'Alice' }, { name: 'Bob' }]);
    input('.search-input', 'missing');
    expect(container.querySelectorAll('.array-item-row')).toHaveLength(2);
    click(container.querySelector('[title="Expand All"]'));
    expect(keys()).toEqual(['name: ', 'name: ']);
  });

  it.each([
    { state: { __type: 'Map', size: 1, entries: { name: 'Alice' } }, summary: '[Map(1)]' },
    { state: { __type: 'Set', size: 1, values: ['Alice'] }, summary: '[Set(1)]' },
    { state: { __type: 'Date', value: '2026-11-25T00:00:00.000Z' }, summary: '2026-11-25T00:00:00.000Z' },
  ])('does not search a root displayed only as $state.__type summary', ({ state, summary }) => {
    render(state);
    const stringify = vi.spyOn(JSON, 'stringify');
    input('.search-input', 'missing');
    expect(container.querySelector('.state-tree')?.textContent).toBe(summary);
    expect(stringify).not.toHaveBeenCalled();
  });
});
