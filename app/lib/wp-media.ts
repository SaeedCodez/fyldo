/**
 * The native WordPress media modal (`wp.media`) for the `image` and `file` fields, and what the fields make of the chosen
 * attachment. Fyldo never uploads anything itself: it opens the frame WordPress ships, takes the attachment the person picks
 * and keeps its ID. The name, size, type and dimensions come from the attachment, never from its URL.
 */
import { __, localizeDigits, sprintf } from '../i18n';
import type { MediaItem } from '../types';

/** The part of a `wp.media` attachment (`toJSON()`) the fields read. */
export interface WpAttachment {
  id: number;
  /** `image`, `video`, `audio`, `application`… */
  type?: string;
  mime?: string;
  filename?: string;
  filesizeInBytes?: number;
  width?: number;
  height?: number;
  sizes?: Record<string, { url: string }>;
}

interface WpModel {
  toJSON(): WpAttachment;
  fetch?(): unknown;
}

interface WpSelection {
  first(): WpModel | undefined;
  add(model: unknown): void;
  reset(): void;
}

export interface WpFrame {
  on(event: 'open' | 'select' | 'close', callback: () => void): unknown;
  open(): unknown;
  state(): { get(name: 'selection'): WpSelection };
}

interface WpMedia {
  (options: { title: string; button: { text: string }; multiple: false; library: { type?: string | string[] } }): WpFrame;
  attachment(id: number): WpModel;
}

/** `wp.media`, or null where WordPress has not loaded it (the harness, the unit tests, a screen without `wp_enqueue_media()`). */
export function wpMedia(): WpMedia | null {
  const wp = (window as unknown as { wp?: { media?: WpMedia } }).wp;
  return typeof wp?.media === 'function' ? wp.media : null;
}

export type MediaKind = 'image' | 'file';

export interface MediaRules {
  kind: MediaKind;
  /** MIME types the field accepts (`null` = every image, or every type). */
  mimes: readonly string[] | null;
  /** Bytes; `null` = no limit. */
  maxSize: number | null;
}

/** An attachment ID from any raw value (`AbstractMediaField::sanitize_value` in PHP): a whole number of 0 or more, else 0. */
export function sanitizeMediaId(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.abs(Math.trunc(n)) : 0;
}

const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
};

/** The object the server sends (`media`), built from what `wp.media` knows about the chosen attachment. */
export function itemFromAttachment(attachment: WpAttachment, kind: MediaKind): MediaItem {
  const filename = attachment.filename ?? '';
  const image = attachment.type === 'image';
  const sizes = attachment.sizes ?? {};
  return {
    id: attachment.id,
    filename,
    filesize: attachment.filesizeInBytes ?? 0,
    mime: attachment.mime ?? '',
    extension: extensionOf(filename),
    width: image ? (attachment.width ?? null) : null,
    height: image ? (attachment.height ?? null) : null,
    thumbnail: kind === 'image' && image ? (sizes.thumbnail?.url ?? sizes.full?.url ?? null) : null,
  };
}

/**
 * Bytes as people read them: "38 KB", "1.2 MB" (1024-based, like WordPress), in the page's numerals and with translated unit
 * names (Persian: ۳۸ کیلوبایت).
 */
export function formatBytes(bytes: number, locale: string): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < 3) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 || value >= 10 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
  const names = [__('B', 'fyldo'), __('KB', 'fyldo'), __('MB', 'fyldo'), __('GB', 'fyldo')];
  return `${localizeDigits(text, locale)} ${names[unit] as string}`;
}

/** The line under the file name: "512 × 512 · 38 KB" for an image, "PDF · 1.2 MB" for a file (Persian puts the size first, as the pack does). */
export function describeItem(item: MediaItem, kind: MediaKind, locale: string): string {
  const size = item.filesize > 0 ? formatBytes(item.filesize, locale) : '';
  if (kind === 'image') {
    const dimensions = item.width && item.height ? localizeDigits(`${item.width} × ${item.height}`, locale) : '';
    // Dimensions and size are separated by the same dot in every language; either may be missing.
    return [dimensions, size].filter(Boolean).join(' · ');
  }
  const type = (item.extension || item.mime.split('/')[1] || '').toUpperCase();
  if (type === '' || size === '') return type || size;
  return sprintf(__('%1$s · %2$s', 'fyldo'), type, size);
}

/** Why a chosen attachment cannot be used (the same wording PHP gives when it refuses it on save), or null when it can. */
export function checkChoice(item: MediaItem, rules: MediaRules, locale: string): string | null {
  const isImage = item.mime.startsWith('image/');
  if (rules.kind === 'image' && !isImage) return __('Choose an image.', 'fyldo');
  if (rules.mimes !== null && !rules.mimes.includes(item.mime)) return __('This file type is not allowed.', 'fyldo');
  if (rules.maxSize !== null && item.filesize > rules.maxSize) return sprintf(__('Choose a file of %s or less.', 'fyldo'), formatBytes(rules.maxSize, locale));
  return null;
}

/** The media library's filter for a field. */
export const libraryFilter = (kind: MediaKind, mimes: readonly string[] | null): { type?: string | string[] } =>
  mimes !== null ? { type: [...mimes] } : kind === 'image' ? { type: 'image' } : {};

