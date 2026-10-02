import { DirectionProvider } from '@base-ui/react/direction-provider';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldRenderer } from '../../app/components/fyldo/FieldRenderer';
import { SelectFileField } from '../../app/components/ui/select-file-field';
import { UploadImageField } from '../../app/components/ui/upload-image-field';
import { setLocaleData } from '../../app/i18n';
import { resetIconCache, setIconLoader } from '../../app/icons/registry';
import { checkChoice, describeItem, formatBytes, itemFromAttachment, type WpAttachment } from '../../app/lib/wp-media';
import type { FieldValue, ImageFieldDef, MediaItem } from '../../app/types';

const PNG: WpAttachment = { id: 7, type: 'image', mime: 'image/png', filename: 'logo-mark.png', filesizeInBytes: 38912, width: 512, height: 512, sizes: { thumbnail: { url: 'https://example.com/logo-150x150.png' } } };
const PDF: WpAttachment = { id: 9, type: 'application', mime: 'application/pdf', filename: 'brand-guidelines.pdf', filesizeInBytes: 1258291 };
const BIG: WpAttachment = { id: 8, type: 'image', mime: 'image/jpeg', filename: 'photo.jpg', filesizeInBytes: 3145728, width: 4000, height: 3000 };

/** A stand-in for `wp.media`: opening runs the frame's `open` handler, `choose` is the person picking something and confirming. */
function stubWpMedia() {
  const handlers: Partial<Record<'open' | 'select' | 'close', () => void>> = {};
  let chosen: unknown[] = [];
  const selection = {
    first: () => chosen[0] as { toJSON(): WpAttachment } | undefined,
    add: vi.fn((model: unknown) => chosen.push(model)),
    reset: vi.fn(() => {
      chosen = [];
    }),
  };
  const frame = {
    on: vi.fn((event: 'open' | 'select' | 'close', callback: () => void) => {
      handlers[event] = callback;
    }),
    open: vi.fn(() => handlers.open?.()),
    state: () => ({ get: () => selection }),
  };
  const attachment = vi.fn((id: number) => ({ id, fetch: vi.fn(), toJSON: () => ({ id }) }));
  const media = Object.assign(
    vi.fn(() => frame),
    { attachment },
  );
  (window as unknown as { wp?: unknown }).wp = { media };
  return {
    media,
    frame,
    attachment,
    selection,
    /** Pick an attachment in the modal and confirm ("Select"): `select`, then the frame closes. */
    choose(picked: WpAttachment) {
      chosen = [{ toJSON: () => picked }];
      act(() => {
        handlers.select?.();
        handlers.close?.();
      });
    },
    /** Close without choosing. */
    dismiss() {
      act(() => handlers.close?.());
    },
  };
}

/** The field as a page holds it: the value and the attachment drawn for it live in state, an error replaces the helper text. */
function Field({
  kind = 'image',
  initial = 0,
  initialMedia = null,
  max,
  mimes = null,
  disabled = false,
  locale = 'en',
  dir = 'ltr',
  onValue,
}: {
  kind?: 'image' | 'file';
  initial?: number;
  initialMedia?: MediaItem | null;
  max?: number;
  mimes?: string[] | null;
  disabled?: boolean;
  locale?: string;
  dir?: 'ltr' | 'rtl';
  onValue?: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  const [media, setMedia] = useState<MediaItem | null>(initialMedia);
  const [error, setError] = useState<string | undefined>();
  const Component = kind === 'image' ? UploadImageField : SelectFileField;
  return (
    <DirectionProvider direction={dir}>
      <div dir={dir}>
        <Component
          label={kind === 'image' ? 'Site logo' : 'Brand guidelines'}
          description="Shown in the sidebar and on the login screen."
          value={value}
          media={media}
          mimes={mimes}
          maxSize={max ?? null}
          error={error}
          disabled={disabled}
          locale={locale}
          onSelect={(item) => {
            setValue(item.id);
            setMedia(item);
            setError(undefined);
            onValue?.(item.id);
          }}
          onRemove={() => {
            setValue(0);
            setMedia(null);
            onValue?.(0);
          }}
          onError={setError}
        />
      </div>
    </DirectionProvider>
  );
}

const PNG_ITEM: MediaItem = { id: 7, filename: 'logo-mark.png', filesize: 38912, mime: 'image/png', extension: 'png', width: 512, height: 512, thumbnail: 'https://example.com/logo-150x150.png' };
const PDF_ITEM: MediaItem = { id: 9, filename: 'brand-guidelines.pdf', filesize: 1258291, mime: 'application/pdf', extension: 'pdf', width: null, height: null, thumbnail: null };

beforeEach(() => {
  setLocaleData(null);
  setIconLoader(async () => [['path', { d: 'M3 12h18' }]]);
});
afterEach(() => {
  setIconLoader(null);
  resetIconCache();
  Reflect.deleteProperty(window, 'wp');
  vi.restoreAllMocks();
});

describe('Upload Image', () => {
  it('is a group named by its label, with the helper text, and one button named after the action and the label', () => {
    render(<Field />);

    const group = screen.getByRole('group', { name: 'Site logo' });
    expect(group).toHaveAccessibleDescription('Shown in the sidebar and on the login screen.');
    expect(screen.getByText('No image selected')).toBeInTheDocument();
    expect(screen.getByText('From the media library')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select image: Site logo' })).toHaveTextContent('Select image');
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it('opens the native media frame: titled with the label, one image, "Select"', async () => {
    const wp = stubWpMedia();
    render(<Field />);

    await userEvent.click(screen.getByRole('button', { name: 'Select image: Site logo' }));

    expect(wp.media).toHaveBeenCalledTimes(1);
    expect(wp.media).toHaveBeenCalledWith({ title: 'Site logo', button: { text: 'Select' }, multiple: false, library: { type: 'image' } });
    expect(wp.frame.open).toHaveBeenCalledTimes(1);
    expect(wp.attachment).not.toHaveBeenCalled(); // nothing to preselect yet
  });

  it('shows the name, size and thumbnail of the chosen attachment, and offers Replace and a remove button', async () => {
    const wp = stubWpMedia();
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);

    await userEvent.click(screen.getByRole('button', { name: 'Select image: Site logo' }));
    wp.choose(PNG);

    expect(onValue).toHaveBeenCalledWith(7);
    expect(screen.getByText('logo-mark.png')).toBeInTheDocument();
    expect(screen.getByText('512 × 512 · 38 KB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace: Site logo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Site logo' })).toBeInTheDocument();
    const thumbnail = document.querySelector('[data-slot=fy-media-tile] img');
    expect(thumbnail).toHaveAttribute('src', 'https://example.com/logo-150x150.png');
    expect(thumbnail).toHaveAttribute('alt', ''); // the name is shown as text
  });

  it('falls back to the placeholder picture when the attachment has no thumbnail or it fails to load', () => {
    const { unmount } = render(<Field initial={7} initialMedia={{ ...PNG_ITEM, thumbnail: null }} />);
    expect(document.querySelector('[data-slot=fy-media-placeholder]')).toBeInTheDocument();
    unmount();

    render(<Field initial={7} initialMedia={PNG_ITEM} />);
    expect(document.querySelector('[data-slot=fy-media-placeholder]')).toBeNull();
    fireEvent.error(document.querySelector('[data-slot=fy-media-tile] img') as HTMLElement);
    expect(document.querySelector('[data-slot=fy-media-tile] img')).toBeNull();
    expect(document.querySelector('[data-slot=fy-media-placeholder]')).toBeInTheDocument();
  });

  it('opens with the current attachment preselected, and Replace swaps it', async () => {
    const wp = stubWpMedia();
    const onValue = vi.fn();
    render(<Field initial={7} initialMedia={PNG_ITEM} onValue={onValue} />);

    await userEvent.click(screen.getByRole('button', { name: 'Replace: Site logo' }));
    expect(wp.attachment).toHaveBeenCalledWith(7);
    expect(wp.selection.add).toHaveBeenCalledTimes(1);

    wp.choose({ ...PNG, id: 11, filename: 'logo-new.png' });
    expect(onValue).toHaveBeenLastCalledWith(11);
    expect(screen.getByText('logo-new.png')).toBeInTheDocument();
    expect(wp.media).toHaveBeenCalledTimes(1); // the frame is created once and reused
  });

  it('returns focus to the field button when the modal closes, chosen or not', async () => {
    const wp = stubWpMedia();
    render(<Field />);
    const button = () => screen.getByRole('button', { name: /^(Select image|Replace): Site logo$/ });

    await userEvent.click(button());
    (document.activeElement as HTMLElement).blur();
    wp.dismiss();
    expect(button()).toHaveFocus();

    await userEvent.click(button());
    (document.activeElement as HTMLElement).blur();
    wp.choose(PNG);
    expect(screen.getByRole('button', { name: 'Replace: Site logo' })).toHaveFocus();
  });

  it('Remove only clears the value: it is 0 again, nothing in the media library is touched, and focus stays on the field', async () => {
    const wp = stubWpMedia();
    const onValue = vi.fn();
    render(<Field initial={7} initialMedia={PNG_ITEM} onValue={onValue} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove Site logo' }));

    expect(onValue).toHaveBeenCalledWith(0);
    expect(screen.getByText('No image selected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select image: Site logo' })).toHaveFocus();
    expect(wp.media).not.toHaveBeenCalled();
  });

  it('refuses a chosen file that is not an image: the error shows and the value stays', async () => {
    const wp = stubWpMedia();
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);

    await userEvent.click(screen.getByRole('button', { name: 'Select image: Site logo' }));
    wp.choose(PDF);

    expect(screen.getByText('Choose an image.')).toBeInTheDocument();
    expect(screen.getByText('No image selected')).toBeInTheDocument();
    expect(onValue).not.toHaveBeenCalled();
  });

  it('refuses an attachment over max_size and keeps the one that was chosen before', async () => {
    const wp = stubWpMedia();
    render(<Field initial={7} initialMedia={PNG_ITEM} max={2097152} />);

    await userEvent.click(screen.getByRole('button', { name: 'Replace: Site logo' }));
    wp.choose(BIG);

    expect(screen.getByText('Choose a file of 2 MB or less.')).toBeInTheDocument();
    expect(screen.getByText('logo-mark.png')).toBeInTheDocument();
    expect(screen.queryByText('photo.jpg')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Replace: Site logo' }));
    wp.choose({ ...PNG, id: 12, filename: 'small.png' });
    expect(screen.queryByText('Choose a file of 2 MB or less.')).not.toBeInTheDocument(); // a good choice clears it
    expect(screen.getByText('small.png')).toBeInTheDocument();
  });

  it('is inert while disabled', async () => {
    const wp = stubWpMedia();
    render(<Field initial={7} initialMedia={PNG_ITEM} disabled />);

    expect(screen.getByRole('button', { name: 'Replace: Site logo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Site logo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Replace: Site logo' }));
    expect(wp.media).not.toHaveBeenCalled();
  });

  it('stays inert and warns once the media library is missing (the harness, a screen without wp_enqueue_media)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const onValue = vi.fn();
    render(<Field onValue={onValue} />);

    await userEvent.click(screen.getByRole('button', { name: 'Select image: Site logo' }));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('wp.media is not available'));
    expect(onValue).not.toHaveBeenCalled();
    expect(screen.getByText('No image selected')).toBeInTheDocument();
  });

  it('narrows the media library to the types the field allows', async () => {
    const wp = stubWpMedia();
    render(<Field mimes={['image/png', 'image/webp']} />);

    await userEvent.click(screen.getByRole('button', { name: 'Select image: Site logo' }));

    expect(wp.media).toHaveBeenCalledWith(expect.objectContaining({ library: { type: ['image/png', 'image/webp'] } }));
  });
});

describe('Select File', () => {
  it('shows the file name, its type and size, and filters the library to the allowed types', async () => {
    const wp = stubWpMedia();
    render(<Field kind="file" initial={9} initialMedia={PDF_ITEM} mimes={['application/pdf']} />);

    expect(screen.getByRole('group', { name: 'Brand guidelines' })).toBeInTheDocument();
    expect(screen.getByText('brand-guidelines.pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF · 1.2 MB')).toBeInTheDocument();
    expect(document.querySelector('[data-slot=fy-media-tile] img')).toBeNull(); // a file shows its tile

    await userEvent.click(screen.getByRole('button', { name: 'Replace: Brand guidelines' }));
    expect(wp.media).toHaveBeenCalledWith({ title: 'Brand guidelines', button: { text: 'Select' }, multiple: false, library: { type: ['application/pdf'] } });
    expect(wp.selection.add).toHaveBeenCalledTimes(1);
  });

  it('is empty with "Select file", takes any type without a filter, and refuses a type that is not allowed', async () => {
    const wp = stubWpMedia();
    const { unmount } = render(<Field kind="file" />);
    expect(screen.getByText('No file selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Select file: Brand guidelines' }));
    expect(wp.media).toHaveBeenCalledWith(expect.objectContaining({ library: {} }));
    wp.choose(PNG); // an image is a file too
    expect(screen.getByText('logo-mark.png')).toBeInTheDocument();
    unmount();

    const second = stubWpMedia();
    render(<Field kind="file" mimes={['application/pdf']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Select file: Brand guidelines' }));
    second.choose(PNG);
    expect(screen.getByText('This file type is not allowed.')).toBeInTheDocument();
    expect(screen.getByText('No file selected')).toBeInTheDocument();
  });
});

describe('Persian', () => {
  const fa = {
    locale_data: {
      messages: {
        '': { domain: 'fyldo', lang: 'fa_IR' },
        KB: ['کیلوبایت'],
        MB: ['مگابایت'],
        '%1$s · %2$s': ['%2$s · %1$s'],
        'Replace': ['جایگزینی'],
      },
    },
  };

  it('writes sizes and dimensions in Persian numerals with translated units, the size first for a file', () => {
    setLocaleData(fa);
    expect(formatBytes(38912, 'fa-IR')).toBe('۳۸ کیلوبایت');
    expect(formatBytes(1258291, 'fa-IR')).toBe('۱٫۲ مگابایت');
    expect(describeItem(PNG_ITEM, 'image', 'fa-IR')).toBe('۵۱۲ × ۵۱۲ · ۳۸ کیلوبایت');
    expect(describeItem(PDF_ITEM, 'file', 'fa-IR')).toBe('۱٫۲ مگابایت · PDF');
  });

  it('renders the filled field in Persian', () => {
    setLocaleData(fa);
    render(<Field initial={7} initialMedia={PNG_ITEM} locale="fa-IR" dir="rtl" />);

    expect(screen.getByText('۵۱۲ × ۵۱۲ · ۳۸ کیلوبایت')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /جایگزینی/ })).toBeInTheDocument();
    expect(screen.getByText('logo-mark.png').closest('bdi')).toHaveAttribute('dir', 'ltr'); // a file name is never mirrored
  });
});

describe('what the picker makes of an attachment', () => {
  it('builds the same object the server sends from the wp.media attachment', () => {
    expect(itemFromAttachment(PNG, 'image')).toEqual(PNG_ITEM);
    expect(itemFromAttachment(PDF, 'file')).toEqual(PDF_ITEM);
    expect(itemFromAttachment(PNG, 'file')).toEqual({ ...PNG_ITEM, thumbnail: null }); // a file field draws a tile, not a thumbnail
    expect(itemFromAttachment({ ...PNG, sizes: { full: { url: 'https://example.com/logo.png' } } }, 'image').thumbnail).toBe('https://example.com/logo.png');
  });

  it('checks the type and size with the wording PHP uses', () => {
    const rules = { kind: 'file' as const, mimes: ['application/pdf'], maxSize: 1048576 };
    expect(checkChoice(PDF_ITEM, { ...rules, maxSize: null }, 'en')).toBeNull();
    expect(checkChoice(PNG_ITEM, rules, 'en')).toBe('This file type is not allowed.');
    expect(checkChoice(PDF_ITEM, rules, 'en')).toBe('Choose a file of 1 MB or less.');
    expect(checkChoice(PDF_ITEM, { kind: 'image', mimes: null, maxSize: null }, 'en')).toBe('Choose an image.');
    expect(checkChoice({ ...PDF_ITEM, filesize: 0 }, rules, 'en')).toBeNull(); // an unknown size cannot be held against the limit
  });
});

describe('inside a Setting Row', () => {
  const field: ImageFieldDef = {
    id: 'site_logo',
    type: 'image',
    label: 'Site logo',
    description: 'Shown in the sidebar and on the login screen.',
    default: 0,
    disabled: false,
    layout: 'field',
    validate: { media: true },
    types: null,
    mimes: null,
    max_size: null,
  };

  function Row({ onChange, onError }: { onChange: (id: string, value: FieldValue, media?: MediaItem | null) => void; onError: (id: string, message: string) => void }) {
    return <FieldRenderer field={field} value={0} media={null} divider={false} onChange={onChange} onBlur={() => undefined} onError={onError} />;
  }

  it('hands the value and the chosen attachment to the page, or the problem when it is refused', async () => {
    const wp = stubWpMedia();
    const onChange = vi.fn();
    const onError = vi.fn();
    render(<Row onChange={onChange} onError={onError} />);

    expect(screen.getByRole('group', { name: 'Site logo' })).toHaveAccessibleDescription('Shown in the sidebar and on the login screen.');

    await userEvent.click(screen.getByRole('button', { name: 'Select image: Site logo' }));
    wp.choose(PNG);
    expect(onChange).toHaveBeenCalledWith('site_logo', 7, PNG_ITEM);

    wp.choose(PDF);
    expect(onError).toHaveBeenCalledWith('site_logo', 'Choose an image.');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
