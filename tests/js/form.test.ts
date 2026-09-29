import { describe, expect, it } from 'vitest';
import { dirtyIds, initialState, reducer, valuesEqual } from '../../app/lib/page-form';
import type { PageDef } from '../../app/types';

const page = { id: 'general', values: { title: 'A', flag: false, tags: ['a'] }, revision: 'r1' } as unknown as PageDef;

describe('page form reducer', () => {
  it('tracks dirty fields against the last saved values', () => {
    let s = initialState(page);
    expect(dirtyIds(s)).toEqual([]);
    s = reducer(s, { type: 'change', id: 'title', value: 'B' });
    s = reducer(s, { type: 'change', id: 'tags', value: ['a', 'b'] });
    expect(dirtyIds(s).sort()).toEqual(['tags', 'title']);
    s = reducer(s, { type: 'change', id: 'title', value: 'A' }); // edited back to the saved value → clean again
    expect(dirtyIds(s)).toEqual(['tags']);
  });

  it('compares arrays by content', () => {
    expect(valuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(valuesEqual(['a'], ['a', 'b'])).toBe(false);
    expect(valuesEqual(false, false)).toBe(true);
    expect(valuesEqual('0', 0)).toBe(false);
  });

  it('editing clears that field’s error and any saved/failed status', () => {
    let s = initialState(page);
    s = reducer(s, { type: 'invalid', errors: { title: 'Nope', flag: 'Also' } });
    s = reducer(s, { type: 'failed', message: 'x' });
    s = reducer(s, { type: 'change', id: 'title', value: 'B' });
    expect(s.errors).toEqual({ flag: 'Also' });
    expect(s.status).toBe('idle');
    expect(s.message).toBe('');
  });

  it('discard restores the saved values', () => {
    let s = initialState(page);
    s = reducer(s, { type: 'change', id: 'title', value: 'B' });
    s = reducer(s, { type: 'discard' });
    expect(s.values.title).toBe('A');
    expect(dirtyIds(s)).toEqual([]);
  });

  it('a successful save adopts the SERVER’s sanitized values and revision, then settles', () => {
    let s = initialState(page);
    s = reducer(s, { type: 'change', id: 'title', value: '  B ' });
    s = reducer(s, { type: 'saving' });
    expect(s.status).toBe('saving');
    s = reducer(s, { type: 'saved', values: { ...s.values, title: 'B' }, revision: 'r2' });
    expect(s).toMatchObject({ status: 'saved', revision: 'r2', values: { title: 'B' }, saved: { title: 'B' } });
    expect(dirtyIds(s)).toEqual([]);
    expect(reducer(s, { type: 'settle' }).status).toBe('idle');
    expect(reducer({ ...s, status: 'error' }, { type: 'settle' }).status).toBe('error'); // only "saved" settles
  });

  it('a conflict replaces local values with the latest and reports an error', () => {
    let s = initialState(page);
    s = reducer(s, { type: 'change', id: 'title', value: 'mine' });
    s = reducer(s, { type: 'conflict', values: { title: 'theirs', flag: true, tags: [] }, revision: 'r9', message: 'changed elsewhere' });
    expect(s).toMatchObject({ status: 'error', message: 'changed elsewhere', revision: 'r9', values: { title: 'theirs' } });
  });
});
