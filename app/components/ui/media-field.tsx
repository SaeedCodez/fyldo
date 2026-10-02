import { Field } from '@base-ui/react/field';
import { useEffect, useId, useRef, useState, type FocusEvent, type ReactElement } from 'react';
import { Icon } from '../../icons/Icon';
import { __, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';
import { checkChoice, describeItem, itemFromAttachment, libraryFilter, wpMedia, type MediaKind, type WpFrame } from '../../lib/wp-media';
import type { MediaItem } from '../../types';
import { Button } from './button';
import { CONTROL_LOOK } from './control';
import { FieldError } from './field-shell';
import { GroupLabelProvider, useGroupLabels } from './group-field';
import { IconButton } from './icon-button';

/** Figma: the Upload Image thumbnail is 64, the Select File tile 40; both are `radius/sm`. */
const TILE: Record<MediaKind, string> = { image: 'fy:size-16', file: 'fy:size-10' };

/** Figma's dashed outline of an empty thumbnail / tile: a 1px `border/input` stroke inside, dashes 4 long with 4 gaps. */
function DashedOutline({ side }: { side: number }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${side} ${side}`}
      className="fy:pointer-events-none fy:absolute fy:inset-0 fy:size-full fy:fill-none fy:stroke-border-input"
      data-slot="fy-media-dashes"
    >
      <rect x="0.5" y="0.5" width={side - 1} height={side - 1} rx="5.5" strokeDasharray="4 4" />
    </svg>
  );
}

/** Figma's placeholder picture (a sun and two hills) for a chosen image that has no thumbnail. */
function PlaceholderPicture(): ReactElement {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className="fy:size-full" data-slot="fy-media-placeholder">
      <circle cx="47" cy="17" r="5" className="fy:fill-background-default" />
      <polygon points="28,30 50,60 6,60" className="fy:fill-border-strong" />
      <polygon points="47,38 64,60 30,60" className="fy:fill-border-hover" />
    </svg>
  );
}

/** The thumbnail (image) or file tile at the start of the control: dashed and empty, or filled with what was chosen. */
function Tile({ kind, item }: { kind: MediaKind; item: MediaItem | null }): ReactElement {
  const side = kind === 'image' ? 64 : 40;
  const [failed, setFailed] = useState<string | null>(null);

  if (item === null) {
    return (
      <span
        aria-hidden="true"
        data-slot="fy-media-tile"
        data-empty=""
        className={cn('fy:relative fy:flex fy:shrink-0 fy:items-center fy:justify-center fy:rounded-sm fy:bg-background-subtle fy:text-icon-secondary', TILE[kind])}
      >
        <DashedOutline side={side} />
        <Icon name={kind === 'image' ? 'gallery-add' : 'document-upload'} size={24} />
      </span>
    );
  }

  if (kind === 'file') {
    return (
      <span
        aria-hidden="true"
        data-slot="fy-media-tile"
        className={cn('fy:box-border fy:flex fy:shrink-0 fy:items-center fy:justify-center fy:rounded-sm fy:border fy:border-border-default fy:bg-background-subtle fy:text-icon-secondary', TILE.file)}
      >
        <Icon name="document-text" size={24} />
      </span>
    );
  }

  const thumbnail = item.thumbnail !== null && failed !== item.thumbnail ? item.thumbnail : null;
  return (
    <span
      aria-hidden="true"
      data-slot="fy-media-tile"
      className={cn('fy:box-border fy:flex fy:shrink-0 fy:overflow-hidden fy:rounded-sm fy:border fy:border-border-default fy:bg-border-default', TILE.image)}
    >
      {thumbnail !== null ? (
        // The name is shown as text beside it, so the picture itself says nothing.
        <img src={thumbnail} alt="" className="fy:size-full fy:object-cover" onError={() => setFailed(thumbnail)} />
      ) : (
        <PlaceholderPicture />
      )}
    </span>
  );
}

export interface MediaPickerProps {
  /** `image`: Upload Image (a thumbnail). `file`: Select File (a file tile). */
  kind: MediaKind;
  /** The field label: the media modal's title and part of the buttons' accessible names. */
  label: string;
  /** The attachment ID (0 = nothing chosen). */
  value: number;
  /** What to draw for `value`; null while nothing is chosen. */
  media: MediaItem | null;
  /** MIME types the field accepts; null = every image (`image`), or every type (`file`). */
  mimes?: readonly string[] | null;
  /** Largest file in bytes; null / omitted = no limit. */
  maxSize?: number | null;
  /** A usable attachment was chosen in the media modal. */
  onSelect: (item: MediaItem) => void;
  /** "Remove" was pressed: the caller sets the value to 0. Nothing is deleted from the media library. */
  onRemove: () => void;
  /** The chosen attachment is the wrong type or too large: the caller shows the message; the value stays. */
  onError: (message: string) => void;
  disabled?: boolean;
  /** The page's locale: sizes and dimensions are written in its numerals. */
  locale?: string;
  /** Focus left the field (the caller validates), or the media modal closed. */
  onBlur?: () => void;
  className?: string;
}

/**
 * Figma "Upload Image" / "Select File" control: a thumbnail (or file tile), the name with its size, and the actions. Empty and
 * filled share one layout and height. "Select …" and "Replace" open the native `wp.media` frame (single selection, filtered to the
 * allowed types, the current attachment preselected); the trash button only clears the value. Use inside a Field (Setting Row
 * `group`, MediaField).
 */
export function MediaPicker({ kind, label, value, media, mimes = null, maxSize = null, onSelect, onRemove, onError, disabled, locale = 'en', onBlur, className }: MediaPickerProps): ReactElement {
  const labels = useGroupLabels();
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<WpFrame | null>(null);
  // What the frame's handlers need: they are created once, on the first click, and must see the latest props.
  const current = useRef({ value, rules: { kind, mimes, maxSize }, locale, onSelect, onError, onBlur });
  useEffect(() => {
    current.current = { value, rules: { kind, mimes, maxSize }, locale, onSelect, onError, onBlur };
  });
  const modalOpen = useRef(false);
  // The first button (Select … / Replace) is where focus belongs after the media modal closes or an attachment is removed.
  const focusPrimary = (): void => root.current?.querySelector<HTMLElement>('[data-slot=fy-button]')?.focus();

  const item: MediaItem | null = value > 0 ? (media !== null && media.id === value ? media : placeholderItem(value)) : null;
  const filled = item !== null;

  const show = (): void => {
    const api = wpMedia();
    if (api === null) {
      console.warn('Fyldo: wp.media is not available on this screen, so the media library cannot open.');
      return;
    }

    if (frame.current === null) {
      const created = api({ title: label, button: { text: __('Select', 'fyldo') }, multiple: false, library: libraryFilter(kind, mimes) });
      created.on('open', () => {
        const selection = created.state().get('selection');
        selection.reset();
        if (current.current.value > 0) {
          const attachment = api.attachment(current.current.value);
          attachment.fetch?.();
          selection.add(attachment);
        }
      });
      created.on('select', () => {
        const attachment = created.state().get('selection').first()?.toJSON();
        if (!attachment) return;
        const chosen = itemFromAttachment(attachment, current.current.rules.kind);
        const problem = checkChoice(chosen, current.current.rules, current.current.locale);
        if (problem !== null) current.current.onError(problem);
        else current.current.onSelect(chosen);
      });
      created.on('close', () => {
        modalOpen.current = false;
        focusPrimary();
        current.current.onBlur?.();
      });
      frame.current = created;
    }

    modalOpen.current = true;
    frame.current.open();
  };

  const leave = (event: FocusEvent<HTMLElement>): void => {
    // Focus moving between the buttons, or into the open media modal, is not leaving the field.
    if (!modalOpen.current && !event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.();
  };

  const remove = (): void => {
    onRemove();
    // The trash button goes away: keep the keyboard where it was working.
    focusPrimary();
    onBlur?.();
  };

  const select = kind === 'image' ? __('Select image', 'fyldo') : __('Select file', 'fyldo');
  const action = filled ? __('Replace', 'fyldo') : select;
  const empty = kind === 'image' ? __('No image selected', 'fyldo') : __('No file selected', 'fyldo');

  return (
    <div
      {...labels}
      ref={root}
      role="group"
      data-slot="fy-media-field"
      data-kind={kind}
      data-filled={filled ? '' : undefined}
      onBlur={leave}
      className={cn('fy:box-border fy:flex fy:w-full fy:items-center fy:gap-3 fy:rounded-sm fy:p-3 fy:text-copy-14', CONTROL_LOOK, className)}
    >
      <Tile kind={kind} item={item} />

      <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-0.5">
        <span className="fy:truncate fy:text-label-13-strong fy:text-text-primary fy:group-data-[disabled]/field:text-text-disabled" data-slot="fy-media-name">
          {item !== null ? <bdi dir="ltr">{item.filename || `#${item.id}`}</bdi> : empty}
        </span>
        <span className="fy:truncate fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled" data-slot="fy-media-meta">
          {item !== null ? describeItem(item, kind, locale) : __('From the media library', 'fyldo')}
        </span>
      </div>

      <div className="fy:flex fy:shrink-0 fy:items-center fy:gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={disabled} aria-label={sprintf(__('%1$s: %2$s', 'fyldo'), action, label)} onClick={show}>
          {action}
        </Button>
        {filled ? <IconButton icon="trash" label={sprintf(__('Remove %s', 'fyldo'), label)} disabled={disabled} onClick={remove} /> : null}
      </div>
    </div>
  );
}

/** A value with no attachment data (the harness, a stored ID the server could not describe): the ID stands in for the name. */
const placeholderItem = (id: number): MediaItem => ({ id, filename: '', filesize: 0, mime: '', extension: '', width: null, height: null, thumbnail: null });

export interface MediaFieldProps extends Omit<MediaPickerProps, 'label' | 'disabled' | 'className'> {
  label: string;
  /** Figma "Helper text". Replaced by `error` while the field is invalid. */
  description?: string;
  /** Figma "Error message": a type or size problem. */
  error?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** Figma "Upload Image" / "Select File": label → control → helper (or error). Setting Rows use `MediaPicker` directly. */
export function MediaField({ label, description, error, disabled, name, className, ...picker }: MediaFieldProps): ReactElement {
  const titleId = useId();
  const descriptionId = useId();

  return (
    <Field.Root invalid={Boolean(error)} disabled={disabled} name={name} className={cn('fy:group/field fy:flex fy:w-full fy:flex-col fy:gap-2', className)} data-slot="fy-media-field-root">
      <div id={titleId} className="fy:text-label-14-strong fy:text-text-primary fy:group-data-[disabled]/field:text-text-disabled">
        {label}
      </div>
      <GroupLabelProvider titleId={titleId} descriptionId={description ? descriptionId : undefined}>
        <MediaPicker {...picker} label={label} disabled={disabled} />
      </GroupLabelProvider>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : description ? (
        <p id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/field:text-text-disabled">
          {description}
        </p>
      ) : null}
    </Field.Root>
  );
}
