import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react';
import { __, formatNumber, sprintf } from '../../i18n';
import { DragHandle } from '../../icons/DragHandle';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { move } from '../../lib/group';
import { Button } from './button';
import { useGroupLabels } from './group-field';
import { GroupItem, type GroupItemStatus } from './group-item';
import { IconButton } from './icon-button';
import { useOptionalToaster } from './toast';
import { Tooltip } from './tooltip';

export interface GroupListProps<T> {
  /** The items, in order: any values (a page's records, a field's rows). */
  items: readonly T[];
  /** Every change of the list: a move, an add, a duplicate, a removal and its Undo, or an item's own edit (`update`). */
  onChange: (items: T[]) => void;
  /** An item's title in its header and in the names of its buttons; empty = "Item 2". */
  title: (item: T, index: number) => string;
  /** One line under the title; `mono` sets it in Mono/12 (a link, a slug). */
  summary?: (item: T, index: number) => string | { text: string; mono?: boolean } | null | undefined;
  /** The header's tile: an Iconsax name, `''` for an empty tile; `undefined` for none. */
  preview?: (item: T, index: number) => string | undefined;
  /** Status labels after the title (Group Item `Status`). */
  status?: (item: T, index: number) => readonly GroupItemStatus[] | undefined;
  /** The item is kept but not in effect (Group Item `State=Inactive`). */
  inactive?: (item: T, index: number) => boolean;
  /** How many errors the item holds: a red border and a count, also while it is closed. */
  errorCount?: (item: T, index: number) => number;
  /** The open item's body: its fields. `update` replaces this item. */
  children: (item: T, index: number, update: (item: T) => void) => ReactNode;
  /** A drag handle per item: pointer, or the keyboard (Space picks up, the arrows move, Space drops, Escape cancels). */
  sortable?: boolean;
  /** Add (at the end), Duplicate (below) and Remove (with Undo in a toast). Needs `create`. */
  addable?: boolean;
  /** A new item for Add. */
  create?: () => T;
  /** A copy for Duplicate; default a deep copy of the JSON value. */
  copy?: (item: T) => T;
  /** Fewest and most items: Remove, and Add and Duplicate, are disabled there; with `max` a count is shown next to Add. */
  min?: number | null;
  max?: number | null;
  addLabel?: string;
  disabled?: boolean;
  /** Grows when a save is refused: the first item with errors opens. */
  reveal?: number;
  /** The page's locale for the count (default `en`). */
  locale?: string;
  /** On its own (not in a Setting Row), name the list. */
  'aria-label'?: string;
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

const toggleSelector = '[data-slot="fy-group-item-toggle"]';

/**
 * Figma "Group" without a schema: a list of Group Items whose content the caller draws. `sortable`: a drag handle per
 * item (pointer, or the keyboard: Space picks the item up, the arrow keys move it, Space drops it, Escape puts it back;
 * every step is announced). `addable`: Add at the end (opens the new item and focuses its first control), Duplicate below
 * an item, Remove at once with Undo in a toast; `min` / `max` disable Remove / Add and Duplicate, and the count next to Add
 * says why. When a save is refused (`reveal` grows) the first item with errors opens. The `group` field is drawn with it.
 */
export function GroupList<T>({
  items,
  onChange,
  title: titleOf,
  summary,
  preview,
  status,
  inactive,
  errorCount,
  children,
  sortable = false,
  addable = false,
  create,
  copy = (item) => JSON.parse(JSON.stringify(item)) as T,
  min = null,
  max = null,
  addLabel,
  disabled = false,
  reveal = 0,
  locale = 'en',
  'aria-label': ariaLabel,
}: GroupListProps<T>): ReactElement {
  const labels = useGroupLabels();
  const toaster = useOptionalToaster();

  // Stable React keys for the items (the values are plain data): kept in step with every add, move and remove.
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
  /** After a render: focus this element (a new item's first control, a moved item's handle…). */
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
    const first = items.findIndex((item, index) => (errorCount?.(item, index) ?? 0) > 0);
    const key = first < 0 ? undefined : synced[first];
    if (key !== undefined && !open.has(key)) setOpen(new Set(open).add(key));
  }

  const count = items.length;
  const atMax = max !== null && count >= max;
  const atMin = min !== null && count <= min;
  const nameOf = (item: T, index: number): string => {
    const text = titleOf(item, index);
    return text.trim() !== '' ? text : sprintf(__('Item %d', 'fyldo'), index + 1);
  };

  const commit = (next: T[], nextKeys: string[]) => {
    setKeys(nextKeys);
    onChange(next);
  };

  const toggle = (key: string, isOpen: boolean) => {
    const next = new Set(open);
    if (isOpen) next.add(key);
    else next.delete(key);
    setOpen(next);
  };

  const add = () => {
    if (atMax || !create) return;
    const key = newKey();
    setOpen(new Set(open).add(key));
    focusNext.current = () =>
      nodes.current.get(key)?.querySelector<HTMLElement>('[data-slot="fy-group-item-body"] :is(input, textarea, button, [role="combobox"])');
    commit([...items, create()], [...synced, key]);
  };

  const duplicate = (index: number) => {
    if (atMax) return;
    const key = newKey();
    focusNext.current = () => nodes.current.get(key)?.querySelector<HTMLElement>(toggleSelector);
    commit(
      [...items.slice(0, index + 1), copy(items[index] as T), ...items.slice(index + 1)],
      [...synced.slice(0, index + 1), key, ...synced.slice(index + 1)],
    );
  };

  const restore = (item: T, key: string, index: number) => {
    const current = latest.current;
    const at = Math.min(index, current.length);
    focusNext.current = () => nodes.current.get(key)?.querySelector<HTMLElement>(toggleSelector);
    setKeys((k) => [...k.slice(0, at), key, ...k.slice(at)]);
    onChange([...current.slice(0, at), item, ...current.slice(at)]);
  };

  const remove = (index: number) => {
    if (atMin) return;
    const item = items[index] as T;
    const key = synced[index] as string;
    const title = nameOf(item, index);
    const neighbour = synced[index + 1] ?? synced[index - 1];
    focusNext.current = () =>
      neighbour ? nodes.current.get(neighbour)?.querySelector<HTMLElement>(toggleSelector) : root.current?.querySelector<HTMLElement>('[data-group-add]');
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
    setDrag({ key: synced[index] as string, from: index, to: index, dy: 0, startY: event.clientY, boxes });
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
      const title = nameOf(items[drag.from] as T, drag.from);
      reorder(drag.from, drag.to);
      if (drag.to !== drag.from) setAnnouncement(sprintf(__('%1$s moved to position %2$d of %3$d.', 'fyldo'), title, drag.to + 1, count));
    }
  };

  /** Where an item sits while one is dragged: the dragged one follows the pointer, the ones it passed make room. */
  const shiftOf = (index: number): number => {
    if (!drag) return 0;
    if (index === drag.from) return drag.dy;
    const [first, second] = drag.boxes;
    const step = (drag.boxes[drag.from]?.height ?? 0) + (first && second ? second.top - (first.top + first.height) : GAP);
    if (index > drag.from && index <= drag.to) return -step;
    if (index < drag.from && index >= drag.to) return step;
    return 0;
  };

  // ── keyboard moving ─────────────────────────────────────────────────────────────────────────────────────────────────
  const position = (index: number) => sprintf(__('Position %1$d of %2$d.', 'fyldo'), index + 1, count);

  const onHandleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = synced[index] as string;
    const title = nameOf(items[index] as T, index);
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
          sprintf(__('%1$s picked up. %2$s Use the arrow keys to move it, Space to drop it, Escape to cancel.', 'fyldo'), title, position(index)),
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
      setAnnouncement(sprintf(__('Move cancelled. %1$s is back at position %2$d of %3$d.', 'fyldo'), title, grabbed.origin + 1, count));
    }
  };

  const label = addLabel || __('Add item', 'fyldo');
  const addButton = (
    <Button data-group-add="" variant="secondary" size="sm" leadingIcon="add" disabled={disabled || atMax || !create} onClick={add}>
      {label}
    </Button>
  );

  return (
    <div ref={root} role="group" {...labels} {...(labels['aria-labelledby'] ? {} : { 'aria-label': ariaLabel })} data-slot="fy-field-group" className="fy:flex fy:flex-col fy:gap-4">
      {count > 0 ? (
        <div data-slot="fy-group-items" className="fy:flex fy:flex-col fy:gap-2">
          {items.map((item, index) => {
            const key = synced[index] as string;
            const title = nameOf(item, index);
            const line = summary?.(item, index);
            const sub = typeof line === 'string' ? { text: line, mono: false } : (line ?? null);
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
                summary={sub && sub.text !== '' ? sub.text : undefined}
                mono={sub?.mono}
                preview={preview?.(item, index)}
                status={status?.(item, index)}
                inactive={inactive?.(item, index)}
                open={open.has(key)}
                onOpenChange={(isOpen) => toggle(key, isOpen)}
                errorCount={errorCount?.(item, index) ?? 0}
                dragging={lifted}
                style={
                  drag
                    ? {
                        transform: shift ? `translateY(${shift}px)` : undefined,
                        transition: drag.key === key ? 'none' : 'transform 150ms cubic-bezier(0.2, 0, 0, 1)',
                      }
                    : undefined
                }
                handle={
                  sortable && count > 1 ? (
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
                  addable ? (
                    <>
                      <IconButton icon="copy" label={sprintf(__('Duplicate %s', 'fyldo'), title)} disabled={disabled || atMax} onClick={() => duplicate(index)} />
                      <IconButton icon="trash" label={sprintf(__('Remove %s', 'fyldo'), title)} disabled={disabled || atMin} onClick={() => remove(index)} />
                    </>
                  ) : null
                }
              >
                {children(item, index, (next) => onChange(items.map((it, j) => (j === index ? next : it))))}
              </GroupItem>
            );
          })}
        </div>
      ) : addable ? (
        <div
          data-slot="fy-group-empty"
          className="fy:flex fy:flex-col fy:items-center fy:gap-4 fy:rounded-md fy:border fy:border-dashed fy:border-border-default fy:bg-background-subtle fy:px-6 fy:py-8 fy:text-center"
        >
          <span className="fy:flex fy:size-10 fy:items-center fy:justify-center fy:rounded-sm fy:border fy:border-border-subtle fy:bg-background-default fy:text-icon-secondary">
            <Icon name="element-plus" size={20} />
          </span>
          <span className="fy:flex fy:flex-col fy:gap-1">
            <span className="fy:text-label-14-strong fy:text-text-primary">{__('No items yet', 'fyldo')}</span>
            <span className="fy:text-copy-13 fy:text-text-secondary">{__('Items you add appear here.', 'fyldo')}</span>
          </span>
          {addButton}
        </div>
      ) : null}

      {addable && count > 0 ? (
        <div data-slot="fy-group-footer" className="fy:flex fy:items-center fy:gap-3">
          {addButton}
          {max !== null ? (
            <span data-slot="fy-group-count" className="fy:text-copy-13 fy:text-text-tertiary">
              {atMax
                ? sprintf(__('%1$s of %2$s. Remove an item to add another.', 'fyldo'), formatNumber(count, locale), formatNumber(max, locale))
                : sprintf(__('%1$s of %2$s', 'fyldo'), formatNumber(count, locale), formatNumber(max, locale))}
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
