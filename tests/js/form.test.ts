import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PAGE_SCOPE,
  SAVED_LINGER_MS,
  createFormStore,
  dirtyIds,
  initialState,
  reducer,
  scopeState,
  valuesEqual,
  type FormState,
} from '../../app/lib/page-form';
import type { PageDef } from '../../app/types';

const page = { id: 'general', values: { title: 'A', flag: false, tags: ['a'] }, revision: 'r1' } as unknown as PageDef;
const change = (s: FormState, id: string, value: unknown, scope = PAGE_SCOPE) => reducer(s, { type: 'change', id, value: value as never, scope });

describe('page form reducer', () => {
  it('tracks dirty fields against the last saved values', () => {
    let s = initialState(page);
    expect(dirtyIds(s)).toEqual([]);
    s = change(s, 'title', 'B');
    s = change(s, 'tags', ['a', 'b']);
    expect(dirtyIds(s).sort()).toEqual(['tags', 'title']);
    s = change(s, 'title', 'A'); // edited back to the saved value → clean again
    expect(dirtyIds(s)).toEqual(['tags']);
  });

  it('compares arrays by content', () => {
    expect(valuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(valuesEqual(['a'], ['a', 'b'])).toBe(false);
    expect(valuesEqual(false, false)).toBe(true);
    expect(valuesEqual('0', 0)).toBe(false);
  });

  it('editing clears that field’s error and the saved/failed status of ITS scope only', () => {
    let s = initialState(page);
    s = reducer(s, { type: 'invalid', errors: { title: 'Nope', flag: 'Also' }, ids: ['title', 'flag'] });
    s = reducer(s, { type: 'failed', scope: 'a', message: 'x' });
    s = reducer(s, { type: 'failed', scope: 'b', message: 'y' });
    s = change(s, 'title', 'B', 'a');
    expect(s.errors).toEqual({ flag: 'Also' });
    expect(scopeState(s, 'a')).toEqual({ status: 'idle', message: '' });
    expect(scopeState(s, 'b')).toEqual({ status: 'error', message: 'y' });
  });

  it('a failed submit marks its scope with the pack’s error message; blur validation marks no scope', () => {
    let s = initialState(page);
    s = reducer(s, { type: 'invalid', errors: { title: 'Nope' }, ids: ['title'] });
    expect(scopeState(s, PAGE_SCOPE).status).toBe('idle');
    s = reducer(s, { type: 'invalid', errors: {}, ids: ['title'] }); // blur: valid again
    expect(s.errors).toEqual({});
    s = reducer(s, { type: 'invalid', errors: { title: 'Nope' }, ids: ['title', 'tags'], scope: PAGE_SCOPE });
    expect(scopeState(s, PAGE_SCOPE)).toEqual({ status: 'error', message: 'Couldn’t save. Check the highlighted fields.' });
  });

  it('discard restores the saved values', () => {
    let s = initialState(page);
    s = change(s, 'title', 'B');
    s = reducer(s, { type: 'discard' });
    expect(s.values.title).toBe('A');
    expect(dirtyIds(s)).toEqual([]);
  });

  it('a successful save adopts the SERVER’s sanitized values and revision, then settles', () => {
    let s = initialState(page);
    s = change(s, 'title', '  B ');
    s = reducer(s, { type: 'saving', scope: PAGE_SCOPE, ids: ['title'] });
    expect(scopeState(s, PAGE_SCOPE).status).toBe('saving');
    s = reducer(s, { type: 'saved', scope: PAGE_SCOPE, sent: { title: '  B ' }, values: { ...s.saved, title: 'B' }, revision: 'r2' });
    expect(s).toMatchObject({ revision: 'r2', values: { title: 'B' }, saved: { title: 'B' } });
    expect(scopeState(s, PAGE_SCOPE).status).toBe('saved');
    expect(dirtyIds(s)).toEqual([]);
    expect(scopeState(reducer(s, { type: 'settle', scope: PAGE_SCOPE }), PAGE_SCOPE).status).toBe('idle');
    const failed = reducer(s, { type: 'failed', scope: PAGE_SCOPE, message: 'x' });
    expect(reducer(failed, { type: 'settle', scope: PAGE_SCOPE })).toBe(failed); // only "saved" settles
  });

  it('a save keeps edits it did not carry: other sections’ fields, and a field typed into while it ran', () => {
    let s = initialState(page);
    s = change(s, 'title', 'B', 'one');
    s = change(s, 'tags', ['x'], 'two'); // another section, not part of this save
    s = reducer(s, { type: 'saving', scope: 'one', ids: ['title'] });
    s = change(s, 'title', 'BC', 'one'); // typed while the request ran
    s = reducer(s, { type: 'saved', scope: 'one', sent: { title: 'B' }, values: { title: 'B', flag: false, tags: ['a'] }, revision: 'r2' });
    expect(s.values).toEqual({ title: 'BC', flag: false, tags: ['x'] });
    expect(dirtyIds(s).sort()).toEqual(['tags', 'title']);
  });

  it('a conflict KEEPS the edits, flags the page and reports an error; reloading adopts the latest values', () => {
    let s = initialState(page);
    s = change(s, 'title', 'mine');
    s = reducer(s, { type: 'conflict', scope: PAGE_SCOPE, message: 'changed elsewhere' });
    expect(s).toMatchObject({ conflict: true, revision: 'r1', values: { title: 'mine' } });
    expect(scopeState(s, PAGE_SCOPE)).toEqual({ status: 'error', message: 'changed elsewhere' });

    s = reducer(s, { type: 'reloading' });
    expect(s.reloading).toBe(true);
    s = reducer(s, { type: 'reloaded', values: { title: 'theirs', flag: true, tags: [] }, revision: 'r9' });
    expect(s).toMatchObject({ conflict: false, reloading: false, revision: 'r9', values: { title: 'theirs' }, saved: { title: 'theirs' }, scopes: {} });
    expect(dirtyIds(s)).toEqual([]);
  });
});

describe('form store', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps each page’s form outside React and tells whether a page is dirty', () => {
    const store = createFormStore([page, { id: 'other', values: { x: 1 }, revision: 'o1' }]);
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch('general', { type: 'change', id: 'title', value: 'B', scope: PAGE_SCOPE });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.isDirty('general')).toBe(true);
    expect(store.isDirty('other')).toBe(false);
    expect(store.get('other').revision).toBe('o1');
  });

  it('"All changes saved" settles after 4 s (O15)', () => {
    vi.useFakeTimers();
    const store = createFormStore([page]);
    store.dispatch('general', { type: 'saved', scope: PAGE_SCOPE, sent: {}, values: page.values, revision: 'r2' });
    vi.advanceTimersByTime(SAVED_LINGER_MS - 1);
    expect(scopeState(store.get('general'), PAGE_SCOPE).status).toBe('saved');
    vi.advanceTimersByTime(1);
    expect(scopeState(store.get('general'), PAGE_SCOPE).status).toBe('idle');
  });

  it('runs one save at a time per page, in order, even when one fails', async () => {
    const store = createFormStore([page]);
    const order: string[] = [];
    let release: () => void = () => undefined;
    const first = store.enqueue('general', () => new Promise<void>((r) => (release = () => (order.push('first'), r()))));
    const second = store.enqueue('general', async () => {
      order.push('second');
      throw new Error('boom');
    });
    const third = store.enqueue('general', async () => order.push('third'));
    await Promise.resolve();
    expect(order).toEqual([]);
    release();
    await first;
    await expect(second).rejects.toThrow('boom');
    await third;
    expect(order).toEqual(['first', 'second', 'third']);
  });
});
