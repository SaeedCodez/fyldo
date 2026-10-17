import { type ReactElement, type ReactNode } from 'react';
import { __ } from '../../i18n';
import { cn } from '../../lib/cn';
import { blankItem, errorKey, itemsOf } from '../../lib/group';
import { itemText, relationIds, useKnownItems, useRelationSearch } from '../../lib/relation';
import type { FieldValue, GroupFieldDef, GroupItemValue, SubFieldDef } from '../../types';
import { GroupList } from '../ui/group-list';

/** What FieldGroup needs to draw one sub-field (FieldRenderer, given by the caller to avoid a circular import). */
export interface SubFieldSlot {
  field: SubFieldDef;
  value: FieldValue;
  /** Error key and `data-field-id`: `<group>.<index>.<sub-field>`. */
  fieldKey: string;
  error: string | undefined;
  disabled: boolean;
  onChange: (value: FieldValue) => void;
  onBlur: () => void;
}

export interface FieldGroupProps {
  field: GroupFieldDef;
  value: FieldValue;
  /** The page's errors: the sub-fields' are keyed `<group>.<index>.<sub-field>`. */
  errors: Record<string, string>;
  /** Changes when a save is refused for invalid values: the first item with an error opens. */
  reveal: number;
  disabled: boolean;
  /** `clear`: the error keys the edit makes stale; omitted = every error of the group. */
  onChange: (value: GroupItemValue[], clear?: string[]) => void;
  /** Blur of a sub-field: validate that one (`<group>.<index>.<sub-field>`). */
  onBlur: (key: string) => void;
  renderField: (slot: SubFieldSlot) => ReactNode;
  locale: string;
}

/** Sub-fields that take both columns of an item's body (the others share a row, two by two). */
const WIDE = new Set<SubFieldDef['type']>(['textarea', 'choice', 'checkbox_group', 'radio']);

/** Per sub-field: whether it spans both columns. A run of half-width fields with an odd count ends with a full-width one. */
function spans(fields: SubFieldDef[]): boolean[] {
  const full = fields.map((f) => WIDE.has(f.type));
  let run: number[] = [];
  const close = () => {
    if (run.length % 2 === 1) full[run[run.length - 1] as number] = true;
    run = [];
  };
  fields.forEach((f, i) => (WIDE.has(f.type) ? close() : run.push(i)));
  close();
  return full;
}

/**
 * Figma "Group" for the `group` field: GroupList (the list, its reordering, adding and removing) with the field's
 * schema: the titles from `item_title` (a post, term or user sub-field shows the chosen item's title), the summary from
 * the first text sub-field, the tile from `item_icon`, and each item's sub-fields two to a row.
 */
export function FieldGroup({ field, value, errors, reveal, disabled, onChange, onBlur, renderField, locale }: FieldGroupProps): ReactElement {
  const items = itemsOf(value);
  // `item_title` may name a post, term or user sub-field: the header then shows the chosen item's title (several, as a list).
  const titleField = field.fields.find((sub) => sub.id === field.item_title);
  const byId = titleField && (titleField.type === 'post' || titleField.type === 'term' || titleField.type === 'user');
  const titles = useKnownItems(useRelationSearch(), `${field.id}.${field.item_title}`, byId ? items.flatMap((item) => relationIds(item[field.item_title])) : []);

  const titleOf = (item: GroupItemValue): string => {
    const raw = field.item_title ? item[field.item_title] : '';
    const title = byId
      ? new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format(
          relationIds(raw).flatMap((id) => {
            const found = titles.get(id);
            return found ? [itemText(found)] : [];
          }),
        )
      : raw;
    return typeof title === 'string' ? title : '';
  };
  const summaryOf = (item: GroupItemValue): { text: string; mono: boolean } | null => {
    for (const sub of field.fields) {
      if (sub.id === field.item_title || (sub.type !== 'text' && sub.type !== 'url' && sub.type !== 'email')) continue;
      const text = item[sub.id];
      if (typeof text === 'string' && text.trim() !== '') return { text, mono: sub.type !== 'text' };
    }
    return null;
  };
  const halves = spans(field.fields);

  return (
    <GroupList<GroupItemValue>
      items={items}
      // A move, an add or a removal changes every item's position: all of the group's messages go.
      onChange={(next) => onChange(next)}
      title={titleOf}
      summary={summaryOf}
      preview={field.item_icon ? (item) => (typeof item[field.item_icon] === 'string' ? (item[field.item_icon] as string) : '') : undefined}
      errorCount={(_, index) => field.fields.filter((sub) => errors[errorKey(field.id, index, sub.id)]).length}
      sortable={field.sortable}
      addable={field.addable}
      create={() => blankItem(field)}
      min={field.min}
      max={field.max}
      addLabel={field.add_label || __('Add item', 'fyldo')}
      disabled={disabled}
      reveal={reveal}
      locale={locale}
    >
      {(item, index) => (
        <div className="fy:grid fy:grid-cols-2 fy:gap-4 fy:wp-mobile:grid-cols-1">
          {field.fields.map((sub, i) => {
            const fieldKey = errorKey(field.id, index, sub.id);
            return (
              <div key={sub.id} className={cn('fy:min-w-0', halves[i] && 'fy:col-span-2 fy:wp-mobile:col-span-1')}>
                {renderField({
                  field: sub,
                  value: sub.id in item ? (item[sub.id] as FieldValue) : sub.default,
                  fieldKey,
                  error: errors[fieldKey],
                  disabled: disabled || sub.disabled !== false,
                  // A sub-field's edit makes only its own message stale.
                  onChange: (next) => onChange(items.map((it, j) => (j === index ? { ...it, [sub.id]: next } : it)), [field.id, fieldKey]),
                  onBlur: () => onBlur(fieldKey),
                })}
              </div>
            );
          })}
        </div>
      )}
    </GroupList>
  );
}
