/**
 * Conditional display (`dependency`): which fields, notices, sections and group sub-fields show for the current values.
 * Mirror of src/Schema/Dependency.php and src/Schema/Visibility.php; both sides run tests/fixtures/dependency-cases.json.
 * A condition on a hidden field never holds, so hiding a field hides what depends on it. A hidden field is neither
 * checked nor sent (the server keeps what is stored).
 */
import {
  isValueField,
  type DependencyDef,
  type DependencyOperator,
  type FieldDef,
  type FieldValue,
  type GroupFieldDef,
  type GroupItemValue,
  type SectionDef,
  type SubFieldDef,
  type ValueFieldDef,
} from '../types';
import { isEmpty, isRange } from './validation';

/** A field as a condition reads it. */
export interface Resolved {
  visible: boolean;
  value: unknown;
}

export type Resolve = (id: string) => Resolved;

/** A number written as text, as both sides read it ("12", "-1.5"; not "1e3" or " 1"). */
const NUMERIC = /^-?\d+(\.\d+)?$/;

const isNumber = (value: unknown): value is number | string =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && NUMERIC.test(value));

function truthy(value: unknown): boolean {
  if (typeof value === 'string') return !['', '0', 'false'].includes(value.toLowerCase());
  if (typeof value === 'number') return value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

/** A scalar as text, the same as PHP's `Dependency::text()`. */
function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function equal(a: unknown, b: unknown): boolean {
  if ((typeof a === 'object' && a !== null) || (typeof b === 'object' && b !== null)) return false;
  if (typeof a === 'boolean' || typeof b === 'boolean') return truthy(a) === truthy(b);
  if ((typeof a === 'number' || typeof b === 'number') && isNumber(a) && isNumber(b))
    return Number(a) === Number(b);
  return text(a) === text(b);
}

/** Order of two values (numbers by size, two texts by their characters), or null when they cannot be ordered. */
function order(a: unknown, b: unknown): number | null {
  if (isNumber(a) && isNumber(b)) return Math.sign(Number(a) - Number(b));
  if (typeof a === 'string' && typeof b === 'string' && a !== '') return a < b ? -1 : a > b ? 1 : 0;
  return null;
}

const any = (value: unknown, targets: readonly unknown[]): boolean =>
  (Array.isArray(value) ? value : [value]).some((one) =>
    targets.some((target) => equal(one, target)),
  );

function is(value: unknown, target: unknown): boolean {
  if (Array.isArray(value)) {
    if (!Array.isArray(target)) return any(value, [target]);
    return value.length === target.length && value.every((one) => any(one, target));
  }
  return equal(value, target);
}

function contains(value: unknown, target: unknown): boolean {
  if (Array.isArray(value)) return any(value, [target]);
  if (typeof value === 'string') return value.includes(text(target));
  return equal(value, target);
}

/** Whether one condition holds for a value. */
export function holds(operator: DependencyOperator, value: unknown, target: unknown): boolean {
  switch (operator) {
    case '==':
      return is(value, target);
    case '!=':
      return !is(value, target);
    case '>':
    case '>=':
    case '<':
    case '<=': {
      const o = order(value, target);
      if (o === null) return false;
      return operator === '>'
        ? o > 0
        : operator === '>='
          ? o >= 0
          : operator === '<'
            ? o < 0
            : o <= 0;
    }
    case 'any':
      return any(value, Array.isArray(target) ? target : [target]);
    case 'not-any':
      return !any(value, Array.isArray(target) ? target : [target]);
    case 'contains':
      return contains(value, target);
    case 'not-contains':
      return !contains(value, target);
    case 'empty':
      return isEmpty(value);
    case 'not-empty':
      return !isEmpty(value);
  }
  return false;
}

/** Whether a dependency holds. */
export function matches(dependency: DependencyDef, resolve: Resolve): boolean {
  const anyOf = dependency.relation === 'or';
  for (const condition of dependency.conditions) {
    const field = resolve(condition.field);
    if ((field.visible && holds(condition.operator, field.value, condition.value)) === anyOf)
      return anyOf;
  }
  return !anyOf;
}

/** A field's value as conditions read it: "nothing chosen" (an image or post ID of 0, a range with both ends empty) is empty. */
export function subjectOf(field: ValueFieldDef | SubFieldDef, value: unknown): unknown {
  const rules = field.validate;
  if (value === 0 && (rules.media || rules.relation)) return null;
  if (isRange(rules) && typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const pair = value as Record<string, unknown>;
    if (isEmpty(pair.start ?? '') && isEmpty(pair.end ?? '')) return '';
  }
  return value;
}

/** Which fields and sections of a form show. */
export interface Visibility {
  /** Field (or notice) `id` shows. */
  field: (id: string) => boolean;
  section: (section: SectionDef) => boolean;
  /** A field of the page as a condition reads it (what a group's sub-fields read outside their item). */
  resolve: Resolve;
  /** The value fields that are hidden. */
  hidden: ReadonlySet<string>;
}

/** Every field shows: a form without dependencies, or a sub-field drawn without its page. */
export const ALL_VISIBLE: Visibility = {
  field: () => true,
  section: () => true,
  resolve: () => ({ visible: true, value: null }),
  hidden: new Set(),
};

/**
 * What shows for `values` (a field missing from them reads as its default): a field when its section shows and its
 * dependency holds, a section when its dependency holds.
 */
export function visibilityOf(
  sections: readonly SectionDef[],
  values: Readonly<Record<string, FieldValue>>,
): Visibility {
  const fields = new Map<string, FieldDef>();
  const sectionOf = new Map<string, SectionDef>();
  const valueFields = new Map<string, ValueFieldDef>();
  for (const section of sections)
    for (const field of section.fields) {
      fields.set(field.id, field);
      sectionOf.set(field.id, section);
      if (isValueField(field)) valueFields.set(field.id, field);
    }
  const known = new Map<string, boolean>();
  const remember = (key: string, answer: () => boolean): boolean => {
    if (!known.has(key)) {
      known.set(key, false); // a cycle (ruled out by the page config) reads "hidden", never loops
      known.set(key, answer());
    }
    return known.get(key) as boolean;
  };

  const section = (s: SectionDef): boolean =>
    remember(`section:${s.id}`, () => !s.dependency || matches(s.dependency, resolve));
  const field = (id: string): boolean => {
    const f = fields.get(id);
    if (!f) return false;
    return remember(
      `field:${id}`,
      () =>
        section(sectionOf.get(id) as SectionDef) &&
        (!f.dependency || matches(f.dependency, resolve)),
    );
  };
  function resolve(id: string): Resolved {
    const f = valueFields.get(id);
    if (!f) return { visible: false, value: null };
    return { visible: field(id), value: subjectOf(f, id in values ? values[id] : f.default) };
  }

  const hidden = new Set<string>();
  for (const id of valueFields.keys()) if (!field(id)) hidden.add(id);
  return { field, section, resolve, hidden };
}

/** The sub-fields one item of a group hides. `outside` resolves the fields of the page. */
export function hiddenSubs(
  group: GroupFieldDef,
  item: GroupItemValue,
  outside: Resolve,
): ReadonlySet<string> {
  const subs = new Map(group.fields.map((sub) => [sub.id, sub]));
  const known = new Map<string, boolean>();
  const visible = (id: string): boolean => {
    if (!known.has(id)) {
      known.set(id, false);
      const dependency = subs.get(id)?.dependency;
      known.set(
        id,
        !dependency ||
          matches(dependency, (ref) => {
            const sub = subs.get(ref);
            return sub
              ? {
                  visible: visible(ref),
                  value: subjectOf(sub, ref in item ? item[ref] : sub.default),
                }
              : outside(ref);
          }),
      );
    }
    return known.get(id) as boolean;
  };
  return new Set(group.fields.filter((sub) => !visible(sub.id)).map((sub) => sub.id));
}

/** Whether any field, notice, sub-field or section of the form has a dependency (none: nothing to work out). */
export const hasDependencies = (sections: readonly SectionDef[]): boolean =>
  sections.some(
    (s) =>
      s.dependency !== undefined ||
      s.fields.some(
        (f) =>
          f.dependency !== undefined ||
          (f.type === 'group' && f.fields.some((sub) => sub.dependency !== undefined)),
      ),
  );
