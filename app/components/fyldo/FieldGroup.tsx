import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { __, formatNumber, sprintf } from '../../i18n';
import { DragHandle } from '../../icons/DragHandle';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { blankItem, errorKey, itemsOf, move } from '../../lib/group';
import type { FieldValue, GroupFieldDef, GroupItemValue, SubFieldDef } from '../../types';
import { Button } from '../ui/button';
import { GroupItem } from '../ui/group-item';
import { IconButton } from '../ui/icon-button';
import { useOptionalToaster } from '../ui/toast';
import { Tooltip } from '../ui/tooltip';
import { useGroupLabels } from '../ui/group-field';

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

let counter = 0;
const newKey = (): string => `fy-item-${++counter}`;

/** Gap between items (`gap-2`), used until two items can be measured. */
const GAP = 8;

interface Drag {
  key: string;
  from: number;
  to: number;
  dy: number;
  startY: number;
  /** Top and height of every item when the drag started. */
  boxes: Array<{ top: number; height: number }>;
}

/**
 * Figma "Group": a list of Group Items that share the same sub-fields. `sortable`: a drag handle per item (pointer, or
 * the keyboard: Space picks the item up, the arrow keys move it, Space drops it, Escape puts it back). `addable`: Add at
 * the end (opens the new item and focuses its first sub-field), Duplicate below an item, Remove at once with Undo in a
 * toast; `min` / `max` disable Remove / Add and Duplicate, and the count next to Add says why. Fixed groups (neither)
 * keep the items PHP declared. When a save fails, the first item with an error opens.
 */
export function FieldGroup({
  field,
  value,
  errors,
  reveal,
  disabled,
  onChange,
  onBlur,
  renderField,
  locale,
}: FieldGroupProps): ReactElement {
  const items = itemsOf(value);
  const labels = useGroupLabels();
  const toaster = useOptionalToaster();

  // Stable React keys for the items (the value is plain data): kept in step with every add, move and remove.
  const [keys, setKeys] = useState<string[]>(() => items.map(newKey));
  const synced = keys.length === items.length ? keys : items.map((_, i) => keys[i] ?? newKey());
  if (synced !== keys) setKeys(synced);

  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [grabbed, setGrabbed] = useState<{ key: string; origin: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const handles = useRef(new Map<string, HTMLButtonElement>());
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(items);
  latest.current = items;
  /** After a render: focus this element (a new item's first sub-field, a moved item's handle…). */
  const focusNext = useRef<(() => HTMLElement | null | undefined) | null>(null);

  useEffect(() => {
    const target = focusNext.current?.();
    focusNext.current = null;
    target?.focus();
  });

  // A refused save opens the first item with an error (in this render, before the page moves focus to its field).
  const [seenReveal, setSeenReveal] = useState(reveal);
  if (reveal !== seenReveal) {
    setSeenReveal(reveal);
    const firstKey = Object.keys(errors).find((key) => key.startsWith(`${field.id}.`));
    const key = firstKey === undefined ? undefined : synced[Number(firstKey.slice(field.id.length + 1).split('.')[0])];
    if (key !== undefined && !open.has(key)) setOpen(new Set(open).add(key));
  }

  const count = items.length;
  const atMax = field.max !== null && count >= field.max;
  const atMin = field.min !== null && count <= field.min;
  const titleOf = (item: GroupItemValue, index: number): string => {
    const title = field.item_title ? item[field.item_title] : '';
    return typeof title === 'string' && title.trim() !== ''
      ? title
      : sprintf(__('Item %d', 'fyldo'), index + 1);
  };
  const summaryOf = (item: GroupItemValue): { text: string; mono: boolean } | null => {
    for (const sub of field.fields) {
      if (
        sub.id === field.item_title ||
        (sub.type !== 'text' && sub.type !== 'url' && sub.type !== 'email')
      )
        continue;
      const text = item[sub.id];
      if (typeof text === 'string' && text.trim() !== '')
        return { text, mono: sub.type !== 'text' };
    }
    return null;
  };

  const commit = (next: GroupItemValue[], nextKeys: string[], clear?: string[]) => {
    setKeys(nextKeys);
    onChange(next, clear);
  };

  const toggle = (key: string, isOpen: boolean) => {
    const next = new Set(open);
    if (isOpen) next.add(key);
    else next.delete(key);
    setOpen(next);
  };

  const add = () => {
    if (atMax) return;
    const key = newKey();
    setOpen(new Set(open).add(key));
    focusNext.current = () =>
      nodes.current
        .get(key)
        ?.querySelector<HTMLElement>(
          '[data-slot="fy-group-item-body"] :is(input, textarea, button, [role="combobox"])',
        );
    commit([...items, blankItem(field)], [...synced, key]);
  };

  const duplicate = (index: number) => {
    if (atMax) return;
    const key = newKey();
    const copy = JSON.parse(JSON.stringify(items[index])) as GroupItemValue;
    focusNext.current = () =>
      nodes.current.get(key)?.querySelector<HTMLElement>('[data-slot="fy-group-item-toggle"]');
    commit(
      [...items.slice(0, index + 1), copy, ...items.slice(index + 1)],
      [...synced.slice(0, index + 1), key, ...synced.slice(index + 1)],
    );
  };

  const restore = (item: GroupItemValue, key: string, index: number) => {
    const current = latest.current;
    const at = Math.min(index, current.length);
    focusNext.current = () =>
      nodes.current.get(key)?.querySelector<HTMLElement>('[data-slot="fy-group-item-toggle"]');
    setKeys((k) => [...k.slice(0, at), key, ...k.slice(at)]);
    onChange([...current.slice(0, at), item, ...current.slice(at)]);
  };

  const remove = (index: number) => {
    if (atMin) return;
    const item = items[index] as GroupItemValue;
    const key = synced[index] as string;
    const title = titleOf(item, index);
    const neighbour = synced[index + 1] ?? synced[index - 1];
    focusNext.current = () =>
      neighbour
        ? nodes.current
            .get(neighbour)
            ?.querySelector<HTMLElement>('[data-slot="fy-group-item-toggle"]')
        : root.current?.querySelector<HTMLElement>('[data-group-add]');
    commit(
      items.filter((_, i) => i !== index),
      synced.filter((_, i) => i !== index),
    );
    toaster?.neutral(sprintf(__('“%s” removed', 'fyldo'), title), {
      action: { label: __('Undo', 'fyldo'), onClick: () => restore(item, key, index) },
    });
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    commit(move(items, from, to), move(synced, from, to));
  };

  // ── pointer dragging ────────────────────────────────────────────────────────────────────────────────────────────────
  const startDrag = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (event.button !== 0 || disabled) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const boxes = synced.map((k) => {
      const r = nodes.current.get(k)?.getBoundingClientRect();
      return { top: r?.top ?? 0, height: r?.height ?? 0 };
    });
    setDrag({
      key: synced[index] as string,
      from: index,
      to: index,
      dy: 0,
      startY: event.clientY,
      boxes,
    });
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const dy = event.clientY - drag.startY;
    const self = drag.boxes[drag.from] as { top: number; height: number };
    const centre = self.top + self.height / 2 + dy;
    let to = drag.from;
    drag.boxes.forEach((box, i) => {
      const mid = box.top + box.height / 2;
      if (i > drag.from && centre > mid) to = Math.max(to, i);
      if (i < drag.from && centre < mid) to = Math.min(to, i);
    });
    setDrag({ ...drag, dy, to });
  };

  const endDrag = (cancel: boolean) => {
    if (!drag) return;
    setDrag(null);
    if (!cancel) {
      const title = titleOf(items[drag.from] as GroupItemValue, drag.from);
      reorder(drag.from, drag.to);
      if (drag.to !== drag.from)
        setAnnouncement(
          sprintf(__('%1$s moved to position %2$d of %3$d.', 'fyldo'), title, drag.to + 1, count),
        );
    }
  };

  /** Where an item sits while one is dragged: the dragged one follows the pointer, the ones it passed make room. */
  const shiftOf = (index: number): number => {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    const [first, second] = drag.boxes;
    const step =
      (drag.boxes[drag.from]?.height ?? 0) +
      (first && second ? second.top - (first.top + first.height) : GAP);
    if (index > drag.from && index <= drag.to) return -step;
    if (index < drag.from && index >= drag.to) return step;
    return 0;
  };

  // ── keyboard moving ─────────────────────────────────────────────────────────────────────────────────────────────────
  const position = (index: number) =>
    sprintf(__('Position %1$d of %2$d.', 'fyldo'), index + 1, count);

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = synced[index] as string;
    const title = titleOf(items[index] as GroupItemValue, index);
    const refocus = () => {
      focusNext.current = () => handles.current.get(key);
    };

    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (grabbed) {
        setGrabbed(null);
        setAnnouncement(sprintf(__('%1$s dropped. %2$s', 'fyldo'), title, position(index)));
      } else {
        setGrabbed({ key, origin: index });
        setAnnouncement(
          sprintf(
            __(
              '%1$s picked up. %2$s Use the arrow keys to move it, Space to drop it, Escape to cancel.',
              'fyldo',
            ),
            title,
            position(index),
          ),
        );
      }
      return;
    }
    if (!grabbed) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const to = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (to < 0 || to >= count) return;
      refocus();
      reorder(index, to);
      setAnnouncement(position(to));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      refocus();
      reorder(index, grabbed.origin);
      setGrabbed(null);
      setAnnouncement(
        sprintf(
          __('Move cancelled. %1$s is back at position %2$d of %3$d.', 'fyldo'),
          title,
          grabbed.origin + 1,
          count,
        ),
      );
    }
  };

  const halves = spans(field.fields);
  const addLabel = field.add_label || __('Add item', 'fyldo');

  return (
    <div
      ref={root}
      role="group"
      {...labels}
      data-slot="fy-field-group"
      className="fy:flex fy:flex-col fy:gap-4"
    >
      {count > 0 ? (
        <div data-slot="fy-group-items" className="fy:flex fy:flex-col fy:gap-2">
          {items.map((item, index) => {
            const key = synced[index] as string;
            const title = titleOf(item, index);
            const summary = summaryOf(item);
            const icon = field.item_icon ? item[field.item_icon] : undefined;
            const itemErrors = field.fields.filter(
              (sub) => errors[errorKey(field.id, index, sub.id)],
            ).length;
            const shift = shiftOf(index);
            const lifted = drag?.key === key || grabbed?.key === key;
            return (
              <GroupItem
                key={key}
                ref={(node) => {
                  if (node) nodes.current.set(key, node);
                  else nodes.current.delete(key);
                }}
                title={title}
                summary={summary?.text}
                mono={summary?.mono}
                preview={field.item_icon ? (typeof icon === 'string' ? icon : '') : undefined}
                open={open.has(key)}
                onOpenChange={(isOpen) => toggle(key, isOpen)}
                errorCount={itemErrors}
                dragging={lifted}
                style={
                  drag
                    ? {
                        transform: shift ? `translateY(${shift}px)` : undefined,
                        transition:
                          drag.key === key ? 'none' : 'transform 150ms cubic-bezier(0.2, 0, 0, 1)',
                      }
                    : undefined
                }
                handle={
                  field.sortable && count > 1 ? (
                    <Tooltip label={sprintf(__('Reorder %s', 'fyldo'), title)}>
                      <button
                        type="button"
                        ref={(node) => {
                          if (node) handles.current.set(key, node);
                          else handles.current.delete(key);
                        }}
                        disabled={disabled}
                        aria-label={sprintf(__('Reorder %s', 'fyldo'), title)}
                        aria-pressed={grabbed?.key === key}
                        data-slot="fy-group-item-handle"
                        className={cn(
                          'fy:flex fy:size-5 fy:touch-none fy:items-center fy:justify-center fy:rounded-xs fy:text-icon-tertiary fy:motion-base fy:focus-ring fy:hover:text-icon-secondary fy:disabled:cursor-not-allowed fy:disabled:text-text-disabled',
                          drag?.key === key ? 'fy:cursor-grabbing' : 'fy:cursor-grab',
                        )}
                        onPointerDown={(event) => startDrag(event, index)}
                        onPointerMove={moveDrag}
                        onPointerUp={() => endDrag(false)}
                        onPointerCancel={() => endDrag(true)}
                        onKeyDown={(event) => onHandleKey(event, index)}
                        onBlur={() => {
                          if (grabbed?.key === key) setGrabbed(null);
                        }}
                      >
                        <DragHandle size={20} />
                      </button>
                    </Tooltip>
                  ) : null
                }
                actions={
                  field.addable ? (
                    <>
                      <IconButton
                        icon="copy"
                        label={sprintf(__('Duplicate %s', 'fyldo'), title)}
                        disabled={disabled || atMax}
                        onClick={() => duplicate(index)}
                      />
                      <IconButton
                        icon="trash"
                        label={sprintf(__('Remove %s', 'fyldo'), title)}
                        disabled={disabled || atMin}
                        onClick={() => remove(index)}
                      />
                    </>
                  ) : null
                }
              >
                <div className="fy:grid fy:grid-cols-2 fy:gap-4 fy:wp-mobile:grid-cols-1">
                  {field.fields.map((sub, i) => {
                    const fieldKey = errorKey(field.id, index, sub.id);
                    return (
                      <div
                        key={sub.id}
                        className={cn(
                          'fy:min-w-0',
                          halves[i] && 'fy:col-span-2 fy:wp-mobile:col-span-1',
                        )}
                      >
                        {renderField({
                          field: sub,
                          value: sub.id in item ? (item[sub.id] as FieldValue) : sub.default,
                          fieldKey,
                          error: errors[fieldKey],
                          disabled: disabled || sub.disabled !== false,
                          onChange: (next) =>
                            onChange(
                              items.map((it, j) => (j === index ? { ...it, [sub.id]: next } : it)),
                              [field.id, fieldKey],
                            ),
                          onBlur: () => onBlur(fieldKey),
                        })}
                      </div>
                    );
                  })}
                </div>
              </GroupItem>
            );
          })}
        </div>
      ) : field.addable ? (
        <div
          data-slot="fy-group-empty"
          className="fy:flex fy:flex-col fy:items-center fy:gap-4 fy:rounded-md fy:border fy:border-dashed fy:border-border-default fy:bg-background-subtle fy:px-6 fy:py-8 fy:text-center"
        >
          <span className="fy:flex fy:size-10 fy:items-center fy:justify-center fy:rounded-sm fy:border fy:border-border-subtle fy:bg-background-default fy:text-icon-secondary">
            <Icon name="element-plus" size={20} />
          </span>
          <span className="fy:flex fy:flex-col fy:gap-1">
            <span className="fy:text-label-14-strong fy:text-text-primary">
              {__('No items yet', 'fyldo')}
            </span>
            <span className="fy:text-copy-13 fy:text-text-secondary">
              {__('Items you add appear here.', 'fyldo')}
            </span>
          </span>
          <Button
            data-group-add=""
            variant="secondary"
            size="sm"
            leadingIcon="add"
            disabled={disabled || atMax}
            onClick={add}
          >
            {addLabel}
          </Button>
        </div>
      ) : null}

      {field.addable && count > 0 ? (
        <div data-slot="fy-group-footer" className="fy:flex fy:items-center fy:gap-3">
          <Button
            data-group-add=""
            variant="secondary"
            size="sm"
            leadingIcon="add"
            disabled={disabled || atMax}
            onClick={add}
          >
            {addLabel}
          </Button>
          {field.max !== null ? (
            <span data-slot="fy-group-count" className="fy:text-copy-13 fy:text-text-tertiary">
              {atMax
                ? sprintf(
                    __('%1$s of %2$s. Remove an item to add another.', 'fyldo'),
                    formatNumber(count, locale),
                    formatNumber(field.max, locale),
                  )
                : sprintf(
                    __('%1$s of %2$s', 'fyldo'),
                    formatNumber(count, locale),
                    formatNumber(field.max, locale),
                  )}
            </span>
          ) : null}
        </div>
      ) : null}

      <div aria-live="assertive" aria-atomic="true" className="fy:sr-only">
        {announcement}
      </div>
    </div>
  );
}
