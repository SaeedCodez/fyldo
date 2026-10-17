/**
 * The `group` field's value (a list of items keyed by sub-field id) and its errors. Mirror of src/Fields/GroupField.php:
 * a sub-field's message is keyed `<group>.<index>.<sub-field>` (index from 0), the group's own message by its id, and
 * the count is only checked once every item is valid.
 */
import type { FieldValue, GroupFieldDef, GroupItemValue } from '../types';
import { customError } from './custom-fields';
import { hiddenSubs, type Resolve } from './dependency';
import { check, messageFor, type Failure } from './validation';

export const itemsOf = (value: FieldValue | undefined): GroupItemValue[] =>
  Array.isArray(value)
    ? (value as unknown[]).filter(
        (item): item is GroupItemValue =>
          typeof item === 'object' && item !== null && !Array.isArray(item),
      )
    : [];

export const errorKey = (groupId: string, index: number, subId: string): string =>
  `${groupId}.${index}.${subId}`;

/** Whether `key` is the error of field `id`: its own (`id`) or one of its sub-fields (`id.…`). */
export const belongsTo = (key: string, id: string): boolean =>
  key === id || key.startsWith(`${id}.`);

/** The first error of field `id` (a group: of any of its sub-fields), in the order they were reported. */
export const firstErrorKey = (errors: Record<string, string>, id: string): string | undefined =>
  Object.keys(errors).find((key) => belongsTo(key, id));

/** The sub-field values a new item starts with: each sub-field's default. */
export const blankItem = (field: GroupFieldDef): GroupItemValue =>
  Object.fromEntries(field.fields.map((sub) => [sub.id, sub.default]));

/** The failure of the item count (`required`, `min`, `max`), or null. */
export function countFailure(field: GroupFieldDef, count: number): Failure | null {
  if (field.validate.required && count === 0) return { rule: 'required', params: {} };
  if (field.min !== null && count < field.min)
    return { rule: 'items_min', params: { min: field.min } };
  if (field.max !== null && count > field.max)
    return { rule: 'items_max', params: { max: field.max } };
  return null;
}

/** Every message of a group's value; {} when it is valid. With `outside` (the page's fields), an item's hidden sub-fields are not checked. */
export function groupErrors(
  field: GroupFieldDef,
  value: FieldValue | undefined,
  outside?: Resolve,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const items = itemsOf(value);
  items.forEach((item, index) => {
    const hidden = outside ? hiddenSubs(field, item, outside) : null;
    for (const sub of field.fields) {
      if (hidden?.has(sub.id)) continue;
      const value = sub.id in item ? item[sub.id] : sub.default;
      const failure = check(sub.validate, value);
      const message = failure ? messageFor(failure) : sub.type === 'custom' ? customError(sub, value) : null;
      if (message) errors[errorKey(field.id, index, sub.id)] = message;
    }
  });
  if (Object.keys(errors).length === 0) {
    const failure = countFailure(field, items.length);
    if (failure) errors[field.id] = messageFor(failure);
  }
  return errors;
}

/** `list` with the entry at `from` moved to `to`. */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [entry] = next.splice(from, 1);
  if (entry !== undefined) next.splice(to, 0, entry);
  return next;
}
