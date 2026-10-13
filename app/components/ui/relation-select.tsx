import { Combobox } from '@base-ui/react/combobox';
import { useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactElement, type ReactNode, type UIEvent } from 'react';
import { Icon } from '../../icons/Icon';
import { __, _n, formatNumber, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../../lib/portal';
import { itemText, relationIds, useKnownItems, useRelationResults, type RelationResults, type RelationSearch } from '../../lib/relation';
import type { RelationItem } from '../../types';
import { Button } from './button';
import { CONTROL_BASE, CONTROL_LOOK, CONTROL_SIZE, type ControlSize } from './control';
import { MenuMessage } from './menu-message';
import { FIELD, ICONS, LINE, OptionBox, START_WITH_TAGS, TAG_SIZE } from './multi-select';
import { POPUP_MAX_HEIGHT } from './select';
import { Tag } from './tag';

export interface RelationSelectProps {
  /** One ID (0 = none), or with `multiple` the IDs in pick order. */
  value: number | number[];
  multiple?: boolean;
  /** Titles the page already has for IDs (the saved items, the ones picked since). Missing ones are fetched. */
  known?: RelationItem[];
  /** The new value and the items behind it (for their titles). */
  onValueChange: (value: number | number[], items: RelationItem[]) => void;
  /** Searches this field's options; null = no server (nothing is found). */
  search: RelationSearch | null;
  /** The field id, or `<group>.<sub-field>` inside a group. */
  path: string;
  placeholder?: string;
  size?: ControlSize;
  /** Tags shown before the non-removable "+n" chip (`multiple`). */
  maxVisibleTags?: number;
  disabled?: boolean;
  name?: string;
  id?: string;
  /** Names the popup. */
  'aria-label'?: string;
  className?: string;
  /** The user is done with the field: the popup closed, or focus left it. */
  onBlur?: () => void;
}

/** Load the next page when the list is scrolled this close to its end. */
const NEAR_END = 80;

/**
 * A post, term or user field: Figma "Select" with Select Menu `Type=Search` (one value) or "Multi Select" with Select Menu
 * `Type=Multi` (`multiple`), whose options come from the server while the user types. Base UI Combobox, search input
 * INSIDE the popup like Multi Select (ARCHITECTURE O14). Before anything is typed the menu lists the most recent items; a
 * Menu Message row shows loading, no results and errors, and sits under the list while the next page loads (on scroll).
 *
 * Keyboard: on the field Enter / Space / ↓ open it, Backspace / Delete clear it (one value) or remove the last tag. In the
 * popup: type to search, ↑ ↓ move, Enter picks (toggles with `multiple`), Esc closes and returns to the field.
 */
export function RelationSelect({
  value,
  multiple = false,
  known = [],
  onValueChange,
  search,
  path,
  placeholder,
  size = 'sm',
  maxVisibleTags = 3,
  disabled,
  name,
  id,
  className,
  onBlur,
  'aria-label': ariaLabel,
}: RelationSelectProps): ReactElement {
  const container = usePortalContainer();
  const locale = container?.lang || undefined;
  const number = (n: number) => (locale ? formatNumber(n, locale) : String(n));

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const searchBox = useRef<HTMLInputElement>(null);
  const searchId = useId();

  const ids = multiple ? relationIds(value) : relationIds(value).slice(0, 1);
  const results = useRelationResults(search, path, query, open);
  const titles = useKnownItems(search, path, ids, known);
  // Every item seen in a result, so a pick always has its title.
  const seen = useRef(new Map<number, RelationItem>());
  for (const item of results.items) seen.current.set(item.value, item);
  const itemOf = (itemId: number): RelationItem | undefined => titles.get(itemId) ?? seen.current.get(itemId);
  // An ID whose title has not arrived yet shows an ellipsis.
  const selected = ids.map((itemId) => itemOf(itemId) ?? { value: itemId, label: '…', hint: '' });

  const collection = useMemo(() => Combobox.createItems(results.items, { getValue: (item) => item.value, getLabel: itemText }), [results.items]);

  const commit = (next: number[]) => {
    const items = next.map(itemOf).filter((item): item is RelationItem => item !== undefined);
    onValueChange(multiple ? next : (next[0] ?? 0), items);
  };
  const remove = (item: RelationItem) => {
    setAnnouncement(sprintf(__('%s removed', 'fyldo'), itemText(item)));
    commit(ids.filter((v) => v !== item.value));
  };
  const clear = () => {
    setAnnouncement(__('Selection cleared', 'fyldo'));
    commit([]);
    searchBox.current?.focus();
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) onBlur?.();
  };
  // Keep the typed words after a pick, so several results of one search can be picked in a row.
  const onInputValueChange = (next: string, details: { isItemPress?: boolean; cancel: () => void }) => {
    if (details.isItemPress) details.cancel();
    else setQuery(next);
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.key === 'Backspace' || event.key === 'Delete') && !open && ids.length > 0 && !disabled) {
      event.preventDefault();
      if (multiple) remove(selected[selected.length - 1]!);
      else {
        setAnnouncement(__('Selection cleared', 'fyldo'));
        commit([]);
      }
    }
  };
  const onFieldBlur = (event: FocusEvent<HTMLElement>) => {
    if (!open && !event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
  };
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (multiple && event.key === 'Backspace' && event.currentTarget.value === '' && selected.length > 0) {
      event.preventDefault();
      remove(selected[selected.length - 1]!);
    }
  };

  const chevron = (
    <span aria-hidden="true" className="fy:flex fy:group-data-[disabled]/field:text-text-disabled">
      <Icon name="arrow-down-2" size={16} className="fy:group-data-[popup-open]/select:hidden" />
      <Icon name="arrow-up-2" size={16} className="fy:hidden fy:group-data-[popup-open]/select:block" />
    </span>
  );

  const menu = (
    <Menu
      results={results}
      multiple={multiple}
      selectedIds={ids}
      ariaLabel={ariaLabel}
      searchBox={
        <div data-slot="fy-relation-search" className="fy:flex fy:items-center fy:gap-2 fy:border-b fy:border-border-default fy:px-3 fy:py-2">
          <Icon name="search-normal" size={16} className="fy:text-icon-tertiary" />
          <Combobox.Input
            ref={searchBox}
            id={searchId}
            // Base UI points every control in the Field at the Field's label: name the search box by its own aria-label instead.
            aria-labelledby={searchId}
            placeholder={__('Search…', 'fyldo')}
            aria-label={__('Search options', 'fyldo')}
            onKeyDown={onSearchKeyDown}
            className="fy:focus-none fy:min-w-0 fy:flex-1 fy:appearance-none fy:border-0 fy:bg-transparent fy:p-0 fy:text-copy-14 fy:text-text-primary fy:outline-none fy:placeholder:text-text-tertiary"
          />
        </div>
      }
      footer={
        multiple ? (
          <div data-slot="fy-relation-footer" className="fy:flex fy:items-center fy:gap-2 fy:border-t fy:border-border-default fy:bg-background-subtle fy:py-1 fy:ps-3 fy:pe-1">
            <span className="fy:min-w-0 fy:flex-1 fy:text-label-13 fy:text-text-secondary" aria-live="polite">
              {sprintf(_n('%s selected', '%s selected', ids.length, 'fyldo'), number(ids.length))}
            </span>
            <Button variant="tertiary" size="sm" disabled={ids.length === 0} onClick={clear}>
              {__('Clear all', 'fyldo')}
            </Button>
          </div>
        ) : null
      }
      container={container}
    />
  );

  const announce = (
    <span role="status" data-slot="fy-relation-announce" className="fy:sr-only">
      {announcement}
    </span>
  );

  if (!multiple) {
    const current = selected[0];
    return (
      <Combobox.Root
        items={collection}
        value={ids[0] ?? null}
        onValueChange={(next) => commit(typeof next === 'number' ? [next] : [])}
        onInputValueChange={onInputValueChange}
        filter={null}
        onOpenChange={onOpenChange}
        disabled={disabled}
        name={name}
        id={id}
      >
        <Combobox.Trigger
          data-slot="fy-relation-select"
          onKeyDown={onFieldKeyDown}
          onBlur={onFieldBlur}
          className={cn(
            'fy:group/select fy:cursor-pointer fy:text-start fy:focus-visible:border-focus-border fy:focus-visible:shadow-focus-input fy:focus-none',
            CONTROL_BASE,
            CONTROL_SIZE[size],
            className,
          )}
        >
          <span
            data-slot="fy-relation-value"
            className={cn('fy:min-w-0 fy:flex-1 fy:truncate', !current && 'fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled')}
          >
            {current ? itemText(current) : placeholder}
          </span>
          <span className="fy:flex fy:shrink-0 fy:text-icon-tertiary">{chevron}</span>
        </Combobox.Trigger>
        {announce}
        {menu}
      </Combobox.Root>
    );
  }

  const visible = selected.slice(0, Math.max(0, maxVisibleTags));
  const hidden = selected.length - visible.length;
  const tagSize = TAG_SIZE[size];

  return (
    <Combobox.Root
      multiple
      items={collection}
      value={ids}
      onValueChange={(next) => commit(next.filter((v): v is number => typeof v === 'number'))}
      onInputValueChange={onInputValueChange}
      filter={null}
      onOpenChange={onOpenChange}
      disabled={disabled}
      name={name}
      id={id}
    >
      <Combobox.Trigger
        render={<div />}
        nativeButton={false}
        data-slot="fy-relation-select"
        data-size={size}
        onKeyDown={onFieldKeyDown}
        onBlur={onFieldBlur}
        className={cn(
          'fy:group/select fy:flex fy:w-full fy:cursor-pointer fy:items-start fy:gap-2 fy:pe-3 fy:text-start',
          selected.length > 0 ? START_WITH_TAGS[size] : 'fy:ps-3',
          'fy:focus-visible:border-focus-border fy:focus-visible:shadow-focus-input fy:focus-none',
          CONTROL_LOOK,
          FIELD[size],
          className,
        )}
      >
        <span data-slot="fy-relation-values" className={cn('fy:flex fy:min-w-0 fy:flex-1 fy:flex-wrap fy:items-center fy:gap-1', LINE[size])}>
          {selected.length === 0 ? (
            <span className="fy:truncate fy:text-text-tertiary fy:group-data-[disabled]/field:text-text-disabled">{placeholder}</span>
          ) : (
            <>
              {visible.map((item) => (
                <Tag key={item.value} label={itemText(item)} size={tagSize} disabled={disabled} onRemove={() => remove(item)} />
              ))}
              {hidden > 0 ? (
                <Tag label={`+${number(hidden)}`} size={tagSize} disabled={disabled} srLabel={sprintf(_n('%s more selected', '%s more selected', hidden, 'fyldo'), number(hidden))} />
              ) : null}
            </>
          )}
        </span>
        <span className={cn('fy:flex fy:shrink-0 fy:items-center fy:self-start fy:text-icon-secondary', ICONS[size])}>{chevron}</span>
      </Combobox.Trigger>
      {announce}
      {menu}
    </Combobox.Root>
  );
}

interface MenuProps {
  results: RelationResults;
  multiple: boolean;
  selectedIds: number[];
  ariaLabel?: string;
  searchBox: ReactNode;
  footer: ReactNode;
  container: HTMLElement | null;
}

/** Select Menu `Type=Search` / `Type=Multi`: Search · options (or a Menu Message) · Footer (`multiple`). */
function Menu({ results, multiple, selectedIds, ariaLabel, searchBox, footer, container }: MenuProps): ReactElement {
  const { items, status, loaded, loadMore, retry } = results;
  const kind = status === 'error' ? 'error' : status === 'loading' || !loaded ? 'loading' : 'empty';

  const onScroll = (event: UIEvent<HTMLElement>) => {
    const list = event.currentTarget;
    if (list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_END) loadMore();
  };

  return (
    <Combobox.Portal container={container ?? undefined}>
      <Combobox.Positioner sideOffset={4} align="start" className="fy:z-50 fy:outline-none">
        <Combobox.Popup
          data-slot="fy-relation-menu"
          aria-label={ariaLabel}
          aria-busy={status === 'loading'}
          className="fy:flex fy:min-w-(--anchor-width) fy:max-w-(--available-width) fy:flex-col fy:overflow-hidden fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:shadow-medium fy:outline-none"
        >
          {searchBox}
          {items.length === 0 ? (
            <div className="fy:p-1">
              <MenuMessage kind={kind} onRetry={retry} />
            </div>
          ) : (
            <Combobox.List
              onScroll={onScroll}
              className="fy:flex fy:flex-col fy:gap-0.5 fy:overflow-y-auto fy:p-1"
              style={{ maxHeight: `min(${POPUP_MAX_HEIGHT}px, var(--available-height))` }}
            >
              {(item: RelationItem) => (
                <Combobox.Item
                  key={item.value}
                  value={item.value}
                  className={cn(
                    'fy:group/option fy:flex fy:h-10 fy:shrink-0 fy:cursor-pointer fy:items-center fy:gap-2 fy:rounded-sm fy:p-2 fy:text-label-14 fy:text-text-primary fy:outline-none fy:select-none',
                    'fy:data-highlighted:bg-surface-default',
                  )}
                >
                  {multiple ? <OptionBox option={{}} selected={selectedIds.includes(item.value)} /> : null}
                  <span className="fy:min-w-0 fy:flex-1 fy:truncate">{itemText(item)}</span>
                  {multiple ? null : (
                    <Combobox.ItemIndicator className="fy:flex fy:shrink-0">
                      <Icon name="tick-circle" size={16} />
                    </Combobox.ItemIndicator>
                  )}
                </Combobox.Item>
              )}
            </Combobox.List>
          )}
          {items.length > 0 && status !== 'idle' ? (
            <div className="fy:px-1 fy:pb-1">
              <MenuMessage kind={status === 'error' ? 'error' : 'loading'} onRetry={retry} />
            </div>
          ) : null}
          {footer}
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  );
}
