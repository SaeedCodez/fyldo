import { Dialog } from '@base-ui/react/dialog';
import { useDirection } from '@base-ui/react/direction-provider';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactElement, type RefObject } from 'react';
import { __, _n, formatNumber, sprintf } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { ICON_NAMES } from '../../icons/names.generated';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../../lib/portal';
import { Button } from './button';
import { IconButton } from './icon-button';
import { IconTile } from './icon-tile';
import { TextField } from './text-field';
import { Tooltip } from './tooltip';

/** Figma: 64px tiles, 8px apart. The grid fills its width with as many as fit (8 at the pack's 568px). */
const TILE = 64;
const GAP = 8;
const GRID_COLUMNS = { gridTemplateColumns: `repeat(auto-fill, ${TILE}px)` };

export interface IconPickerModalProps {
  open: boolean;
  /** The field's control: focus goes back to it on close. */
  anchorRef: RefObject<HTMLElement | null>;
  /** The icon the field holds now: preselected and scrolled into view. */
  value: string;
  /** The names to offer; `null` = every Iconsax icon. */
  icons: readonly string[] | null;
  locale: string;
  /** "Select icon". */
  onSelect: (name: string) => void;
  /** Cancel, the close button or Escape: nothing changes. */
  onClose: () => void;
}

/**
 * The lazily loaded half of the Icon Picker: this module, the icon names and Base UI's Dialog are a separate chunk, so the main
 * bundle stays small. Figma "Icon Picker Modal": 618 wide, `radius/lg`, a header (title, description, close), a search box, a
 * count line, an 8-column grid of Icon Tiles 372 high that scrolls, and a footer with the selected icon, Cancel and "Select icon".
 */
export default function IconPickerModal({ open, anchorRef, value, icons, locale, onSelect, onClose }: IconPickerModalProps): ReactElement {
  const container = usePortalContainer();
  const popup = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        // Choosing is deliberate: a stray click on the scrim must not throw the choice away. Esc and the close button do.
        if (!next && details.reason !== 'outside-press') onClose();
      }}
    >
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Backdrop
          data-slot="fy-modal-backdrop"
          className="fy:fixed fy:inset-0 fy:z-50 fy:bg-background-overlay fy:transition-opacity fy:duration-150 fy:ease-out fy:data-starting-style:opacity-0 fy:data-ending-style:opacity-0 fy:motion-reduce:transition-none"
        />
        <Dialog.Viewport className="fy:fixed fy:inset-0 fy:z-50 fy:flex fy:items-center fy:justify-center fy:p-4">
          <Dialog.Popup
            data-slot="fy-icon-picker-modal"
            ref={popup}
            initialFocus={() => popup.current?.querySelector<HTMLElement>('[data-icon-search]') ?? true}
            finalFocus={anchorRef}
            className="fy:flex fy:max-h-full fy:w-154.5 fy:max-w-full fy:flex-col fy:overflow-hidden fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:shadow-large fy:outline-none fy:transition fy:duration-150 fy:ease-out fy:data-starting-style:scale-98 fy:data-starting-style:opacity-0 fy:data-ending-style:scale-98 fy:data-ending-style:opacity-0 fy:motion-reduce:transition-none"
          >
            <IconPickerBody value={value} icons={icons} locale={locale} onSelect={onSelect} onClose={onClose} />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** What moves focus in the grid: arrows by one tile (mirrored in RTL) or one row, Home / End to the ends. */
function target(key: string, from: number, count: number, columns: number, rtl: boolean): number | null {
  const clamp = (index: number): number => Math.max(0, Math.min(count - 1, index));
  switch (key) {
    case 'ArrowRight':
      return clamp(from + (rtl ? -1 : 1));
    case 'ArrowLeft':
      return clamp(from + (rtl ? 1 : -1));
    case 'ArrowDown':
      // Past the last full row: the last tile, as long as the row below has any.
      return from + columns < count ? from + columns : from < Math.floor((count - 1) / columns) * columns ? count - 1 : from;
    case 'ArrowUp':
      return from - columns >= 0 ? from - columns : from;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

interface GridTileProps {
  name: string;
  selected: boolean;
  tabbable: boolean;
  showIcon: boolean;
  watch: (el: HTMLElement | null) => void;
  onChoose: (name: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

const GridTile = memo(function GridTile({ name, selected, tabbable, showIcon, watch, onChoose, onKeyDown }: GridTileProps): ReactElement {
  return <IconTile ref={watch} icon={name} selected={selected} showIcon={showIcon} tabIndex={tabbable ? 0 : -1} onClick={() => onChoose(name)} onKeyDown={onKeyDown} />;
});

function IconPickerBody({ value, icons, locale, onSelect, onClose }: Pick<IconPickerModalProps, 'value' | 'icons' | 'locale' | 'onSelect' | 'onClose'>): ReactElement {
  const rtl = useDirection() === 'rtl';
  const searchBox = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const all = icons ?? ICON_NAMES;
  // Only the choice of a name this picker offers counts as selected (an unknown name that the server accepted stays unselected).
  const [pending, setPending] = useState(() => (all.includes(value) ? value : ''));
  const [active, setActive] = useState(pending);

  const needle = query.trim().toLowerCase();
  const names = useMemo(() => (needle === '' ? all : all.filter((name) => name.includes(needle))), [all, needle]);
  const tabbable = names.includes(active) ? active : names[0];

  // Every tile is in the DOM, but a tile's icon module is fetched only once the tile has scrolled (nearly) into view.
  const [seen, setSeen] = useState<ReadonlySet<string>>(() => new Set());
  const [observer, setObserver] = useState<IntersectionObserver | null>(null);
  const observable = typeof IntersectionObserver !== 'undefined';
  useEffect(() => {
    if (!scroller || !observable) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hits = entries.filter((entry) => entry.isIntersecting);
        if (hits.length === 0) return;
        for (const entry of hits) io.unobserve(entry.target);
        setSeen((before) => new Set([...before, ...hits.map((entry) => (entry.target as HTMLElement).dataset.icon as string)]));
      },
      { root: scroller, rootMargin: `${TILE * 2}px 0px` },
    );
    setObserver(io);
    return () => io.disconnect();
  }, [scroller, observable]);
  const watch = useCallback(
    (el: HTMLElement | null) => {
      if (el && observer) observer.observe(el);
    },
    [observer],
  );

  // On open the current icon is in view (centred when it is far down the grid).
  useEffect(() => {
    scroller?.querySelector<HTMLElement>('[data-selected]')?.scrollIntoView?.({ block: 'center' });
  }, [scroller]);

  const focusTile = (name: string | undefined): void => {
    if (name === undefined) return;
    setActive(name);
    scroller?.querySelector<HTMLElement>(`[data-icon="${name}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const from = names.indexOf(event.currentTarget.dataset.icon as string);
    const columns = Math.max(1, Math.floor(((scroller?.clientWidth ?? 0) + GAP) / (TILE + GAP)));
    const to = from < 0 ? null : target(event.key, from, names.length, columns, rtl);
    if (to === null) return;
    event.preventDefault();
    focusTile(names[to]);
  };
  // The handler reads the latest names and width; GridTile is memoised on a stable function that calls it.
  const latest = useRef(onKeyDown);
  latest.current = onKeyDown;
  const stableKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => latest.current(event), []);
  const choose = useCallback((name: string) => {
    setPending(name);
    setActive(name);
  }, []);

  const count = names.length;
  const summary =
    needle === ''
      ? sprintf(_n('%s icon', '%s icons', count, 'fyldo'), formatNumber(count, locale))
      : sprintf(_n('%1$s result for “%2$s”', '%1$s results for “%2$s”', count, 'fyldo'), formatNumber(count, locale), query.trim());

  return (
    <>
      <div className="fy:flex fy:items-start fy:gap-4 fy:px-6 fy:pt-6 fy:pb-4">
        <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-1">
          <Dialog.Title className="fy:text-heading-20 fy:text-text-primary">{__('Choose an icon', 'fyldo')}</Dialog.Title>
          <Dialog.Description className="fy:text-copy-14 fy:text-text-secondary">{__('Search the library, then pick one icon.', 'fyldo')}</Dialog.Description>
        </div>
        <IconButton icon="close-circle" label={__('Close', 'fyldo')} data-slot="fy-modal-close" onClick={onClose} />
      </div>

      <div ref={searchBox} className="fy:px-6 fy:pb-4">
        <TextField
          hideLabel
          label={__('Search icons', 'fyldo')}
          size="md"
          prefixIcon="search-normal"
          placeholder={__('Search icons…', 'fyldo')}
          value={query}
          onValueChange={setQuery}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-icon-search=""
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && names.length > 0) {
              event.preventDefault();
              focusTile(tabbable);
            }
          }}
          suffix={
            query === '' ? undefined : (
              // Design rule 10: an icon-only button says what it does — the tooltip repeats its name.
              <Tooltip label={__('Clear search', 'fyldo')}>
                <button
                  type="button"
                  data-slot="fy-icon-search-clear"
                  aria-label={__('Clear search', 'fyldo')}
                  onClick={() => {
                    setQuery('');
                    searchBox.current?.querySelector('input')?.focus();
                  }}
                  className="fy:relative fy:inline-flex fy:size-4 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-xs fy:text-icon-secondary fy:transition-colors fy:duration-100 fy:ease-out fy:hover:text-icon-primary fy:focus-ring fy:before:absolute fy:before:-inset-1"
                >
                  <Icon name="close-circle" size={16} />
                </button>
              </Tooltip>
            )
          }
        />
      </div>

      <p role="status" data-slot="fy-icon-count" className="fy:px-6 fy:pb-3 fy:text-copy-13 fy:text-text-secondary">
        {summary}
      </p>

      <div className="fy:flex fy:min-h-0 fy:flex-col fy:px-6 fy:pb-6">
        {count === 0 ? (
          <div data-slot="fy-icon-empty" className="fy:flex fy:h-93 fy:shrink fy:flex-col fy:items-center fy:justify-center fy:gap-3 fy:text-center">
            <span aria-hidden="true" className="fy:flex fy:size-12 fy:items-center fy:justify-center fy:rounded-md fy:border fy:border-border-default fy:bg-background-subtle fy:text-icon-tertiary">
              <Icon name="search-normal" size={24} />
            </span>
            <span className="fy:text-label-14-strong fy:text-text-primary">{__('No icons found', 'fyldo')}</span>
            <span className="fy:text-copy-14 fy:text-text-secondary">{__('Try another keyword, like “home” or “arrow”.', 'fyldo')}</span>
          </div>
        ) : (
          // The scrollbar sits in the body's end padding (not over the tiles): the area is 16px wider than the grid.
          <div
            ref={setScroller}
            role="listbox"
            tabIndex={-1}
            aria-label={__('Icons', 'fyldo')}
            data-slot="fy-icon-grid"
            style={GRID_COLUMNS}
            className="fy:-me-4 fy:grid fy:h-93 fy:min-h-24 fy:shrink fy:content-start fy:justify-start fy:gap-2 fy:overflow-y-auto fy:scrollbar-thin fy:outline-none"
          >
            {names.map((name) => (
              <GridTile key={name} name={name} selected={name === pending} tabbable={name === tabbable} showIcon={!observable || seen.has(name)} watch={watch} onChoose={choose} onKeyDown={stableKeyDown} />
            ))}
          </div>
        )}
      </div>

      <div className="fy:flex fy:items-center fy:justify-between fy:gap-4 fy:border-t fy:border-border-default fy:bg-background-subtle fy:px-6 fy:py-4">
        <div data-slot="fy-icon-selection" className="fy:flex fy:min-w-0 fy:items-center fy:gap-3">
          {pending === '' ? (
            <>
              <svg aria-hidden="true" viewBox="0 0 32 32" className="fy:block fy:size-8 fy:shrink-0 fy:fill-none fy:stroke-border-default">
                <rect x="0.5" y="0.5" width="31" height="31" rx="5.5" strokeDasharray="2 2" />
              </svg>
              <span className="fy:text-copy-14 fy:text-text-secondary">{__('No icon selected', 'fyldo')}</span>
            </>
          ) : (
            <>
              <span aria-hidden="true" className="fy:box-border fy:flex fy:size-8 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-sm fy:border fy:border-border-default fy:bg-background-default fy:text-icon-primary">
                <Icon name={pending} size={16} />
              </span>
              <span className="fy:flex fy:min-w-0 fy:flex-col">
                <span className="fy:text-copy-13 fy:text-text-secondary">{__('Selected icon', 'fyldo')}</span>
                <span data-slot="fy-icon-selection-name" className="fy:truncate fy:text-mono-14 fy:text-text-primary">
                  <bdi dir="ltr">{pending}</bdi>
                </span>
              </span>
            </>
          )}
        </div>
        <div className={cn('fy:flex fy:shrink-0 fy:items-center fy:gap-2')}>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {__('Cancel', 'fyldo')}
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={pending === ''} onClick={() => onSelect(pending)}>
            {__('Select icon', 'fyldo')}
          </Button>
        </div>
      </div>
    </>
  );
}
