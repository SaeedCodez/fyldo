import { useId, type ReactElement, type ReactNode } from 'react';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { Tag } from './tag';

/** One footer meta item: a 16px Iconsax icon and a short text ("Ends in 23 hours", "1,240"). */
export interface ItemCardDetail {
  icon: string;
  label: ReactNode;
}

export interface ItemCardProps {
  /** The record's name, on one line (it truncates). It is the link or button that opens the record (`href` / `onOpen`). */
  title: string;
  /** A short count or fact at the end of the title row ("3 slides"). */
  meta?: ReactNode;
  /** At most two lines (the rest is cut with an ellipsis). */
  description?: ReactNode;
  /**
   * The plugin's own picture of the record (a cover image, an avatar, a preview), centred in a 136px area on
   * `background/subtle`. It is not interactive: a click on it opens the record. Omit it and there is no media area.
   */
  media?: ReactNode;
  /** A Badge at the top start (Published, Draft, Scheduled): over the media, or above the title without media. */
  status?: ReactNode;
  /** One more Badge at the top end, for a flag such as Pinned. */
  flag?: ReactNode;
  /** Non-removable Small Tags under the title (already translated). */
  tags?: string[];
  /** Footer meta, at most 2 (more are not shown). */
  details?: ItemCardDetail[];
  /** Tertiary Small IconButtons at the end of the footer (edit, duplicate, delete). They stay separate from opening the card. */
  actions?: ReactNode;
  /** Opens the record. The title becomes a button stretched over the card, so the whole card is clickable. */
  onOpen?: () => void;
  /** Opens the record by link. The title becomes a link stretched over the card; `onOpen` (if any) also runs on click. */
  href?: string;
  className?: string;
}

/*
 * Figma "Item Card" (Type=Default), 304 wide in Figma; in code it fills its grid cell. Radius lg, 1px `border/default`,
 * `background/default`, clipped. Media 136 high on `background/subtle`; the two badges sit 12px in from the top and the
 * sides. Body 16 all round, gap 12: title (Label/14 Strong) + meta (Label/12 `text/tertiary`) 8 apart, description
 * (Copy/13 `text/secondary`), tags 6 apart. Footer: top border, padding 8 / 12 (end) / 8 / 16 (start); meta items 12 apart
 * (icon 16 `icon/tertiary` + Label/12 `text/secondary`, 4 apart), clipped like the Figma frame; actions 4 apart.
 * State=Hover (a card that opens): `border/hover` + Shadow/Small.
 */

/**
 * One record in a grid of a list page (stories, forms, redirects). When it opens (`href` or `onOpen`), its title is
 * a real link or button whose box covers the card, so a click anywhere opens it, while the action buttons sit above
 * that box and keep their own clicks. Keyboard users reach the title, then each action.
 */
export function ItemCard({ title, meta, description, media, status, flag, tags = [], details = [], actions, onOpen, href, className }: ItemCardProps): ReactElement {
  const titleId = useId();
  const opens = href !== undefined || onOpen !== undefined;
  const badges =
    status || flag ? (
      <div data-slot="fy-item-card-badges" className={cn('fy:flex fy:items-start fy:justify-between fy:gap-2', media !== undefined && 'fy:absolute fy:inset-x-3 fy:top-3')}>
        <span className="fy:flex">{status}</span>
        <span className="fy:flex">{flag}</span>
      </div>
    ) : null;

  // The title's box (`after:absolute after:inset-0`) covers the card; `focus-ring-cover` draws the keyboard ring inside it.
  const opener = 'fy:flex fy:min-w-0 fy:flex-1 fy:text-start fy:text-text-primary fy:no-underline fy:after:absolute fy:after:inset-0 fy:focus-ring-cover';
  const label = <span className="fy:block fy:min-w-0 fy:truncate">{title}</span>;
  const shown = details.slice(0, 2);

  return (
    <article
      aria-labelledby={titleId}
      data-slot="fy-item-card"
      className={cn(
        'fy:relative fy:flex fy:w-full fy:flex-col fy:overflow-hidden fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default',
        opens && 'fy:motion-base fy:hover:border-border-hover fy:hover:shadow-small',
        className,
      )}
    >
      {media !== undefined ? (
        <div data-slot="fy-item-card-media" className="fy:relative fy:flex fy:h-34 fy:shrink-0 fy:items-center fy:justify-center fy:overflow-hidden fy:bg-background-subtle">
          {media}
          {badges}
        </div>
      ) : null}
      <div data-slot="fy-item-card-body" className="fy:flex fy:flex-1 fy:flex-col fy:gap-3 fy:p-4">
        {media === undefined ? badges : null}
        <div className="fy:flex fy:items-center fy:gap-2">
          {href !== undefined ? (
            <a id={titleId} href={href} onClick={onOpen} data-slot="fy-item-card-open" className={cn(opener, 'fy:text-label-14-strong')}>
              {label}
            </a>
          ) : onOpen !== undefined ? (
            <button type="button" id={titleId} onClick={onOpen} data-slot="fy-item-card-open" className={cn(opener, 'fy:text-label-14-strong')}>
              {label}
            </button>
          ) : (
            <span id={titleId} className="fy:min-w-0 fy:flex-1 fy:truncate fy:text-label-14-strong fy:text-text-primary">
              {title}
            </span>
          )}
          {meta !== undefined && meta !== null ? <span className="fy:shrink-0 fy:whitespace-nowrap fy:text-label-12 fy:text-text-tertiary">{meta}</span> : null}
        </div>
        {description !== undefined && description !== null ? <p className="fy:line-clamp-2 fy:text-copy-13 fy:text-text-secondary">{description}</p> : null}
        {tags.length > 0 ? (
          <div data-slot="fy-item-card-tags" className="fy:flex fy:flex-wrap fy:items-center fy:gap-1.5">
            {tags.map((tag) => (
              <Tag key={tag} label={tag} size="sm" />
            ))}
          </div>
        ) : null}
      </div>
      {shown.length > 0 || actions ? (
        <div data-slot="fy-item-card-footer" className="fy:flex fy:items-center fy:border-t fy:border-border-default fy:py-2 fy:ps-4 fy:pe-3">
          {shown.length > 0 ? (
            <div className="fy:flex fy:min-w-0 fy:flex-1 fy:items-center fy:gap-3 fy:overflow-hidden">
              {shown.map((detail, index) => (
                <span key={index} className="fy:flex fy:shrink-0 fy:items-center fy:gap-1 fy:whitespace-nowrap fy:text-label-12 fy:text-text-secondary">
                  <Icon name={detail.icon} size={16} className="fy:text-icon-tertiary" />
                  {detail.label}
                </span>
              ))}
            </div>
          ) : null}
          {/* Above the title's stretched box, so a click on an action never opens the card. */}
          {actions ? <div className="fy:relative fy:z-10 fy:ms-auto fy:flex fy:shrink-0 fy:items-center fy:gap-1">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  );
}

export interface AddItemCardProps {
  /** What it creates ("Add item", "New story"). */
  title: string;
  /** One short sentence under the title. */
  description?: string;
  /** Opens the editor for a new item (a button). */
  onClick?: () => void;
  /** Or a link to that editor. */
  href?: string;
  className?: string;
}

/**
 * Figma "Item Card" Type=Add: the last cell of the grid, a real button (or link with `href`) that fills its cell.
 * Dashed 1px `border/hover`, radius lg, padding 24, a centred column 12 apart: a 40px round `brand/subtle` box with a
 * 20px `add` in `brand/text`, then the title (Label/14 Strong) and description (Copy/13 `text/secondary`), 4 apart.
 * Hover: `background/subtle` + `border/strong`. Hide it while a search or filter is applied.
 */
export function AddItemCard({ title, description, onClick, href, className }: AddItemCardProps): ReactElement {
  const classes = cn(
    'fy:flex fy:h-full fy:w-full fy:flex-col fy:items-center fy:justify-center fy:gap-3 fy:rounded-lg fy:border fy:border-dashed fy:border-border-hover fy:bg-background-default fy:p-6 fy:text-center fy:no-underline',
    'fy:motion-base fy:hover:border-border-strong fy:hover:bg-background-subtle fy:focus-ring',
    className,
  );
  const content = (
    <>
      <span aria-hidden="true" className="fy:flex fy:size-10 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-full fy:bg-brand-subtle fy:text-brand-text">
        <Icon name="add" size={20} />
      </span>
      <span className="fy:flex fy:w-full fy:flex-col fy:items-center fy:gap-1">
        <span className="fy:text-label-14-strong fy:text-text-primary">{title}</span>
        {description ? <span className="fy:text-copy-13 fy:text-text-secondary">{description}</span> : null}
      </span>
    </>
  );

  return href !== undefined ? (
    <a href={href} onClick={onClick} data-slot="fy-add-item-card" className={classes}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} data-slot="fy-add-item-card" className={classes}>
      {content}
    </button>
  );
}
