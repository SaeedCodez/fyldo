/* eslint-disable fyldo/no-hex-colors -- the Area, the Hue strip and the thumbs paint literal colours on purpose: the colour is the data (design brief). */
import { useDirection } from '@base-ui/react/direction-provider';
import { Field } from '@base-ui/react/field';
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react';
import { __, formatNumber, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';
import { DEFAULT_PRESETS, hexToHsv, hsvToHex, hueColor, parseHex, type Hsv } from '../../lib/color';
import { ColorSwatch } from './color-swatch';
import { Input } from './input';

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Presets wrap at 8 per row inside the panel's 254px content width (8 × 24 + 7 × 8). */
const PRESET_COLUMNS = 8;

const percent = (n: number, locale: string): string => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(n / 100);

/** Figma Area / Hue thumb: a 16px circle, 2px `control/thumb` stroke, Shadow/Thumb, filled with the colour under it. */
const THUMB = 'fy:absolute fy:box-border fy:size-4 fy:-translate-x-1/2 fy:-translate-y-1/2 fy:rounded-full fy:border-2 fy:border-control-thumb fy:shadow-thumb fy:focus-ring-inner';

function useDrag(onMove: (event: PointerEvent<HTMLDivElement>, rect: DOMRect) => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onMove(event, event.currentTarget.getBoundingClientRect());
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (event.buttons === 1) onMove(event, event.currentTarget.getBoundingClientRect());
    },
  };
}

/**
 * Saturation (left to right) × brightness (bottom to top) of the current hue. A spatial map: it does not mirror in
 * Persian, so the arrow keys follow the screen (Right = more saturated) in both directions.
 */
function Area({ hsv, current, locale, onChange }: { hsv: Hsv; current: string; locale: string; onChange: (next: Hsv) => void }): ReactElement {
  const drag = useDrag((event, rect) => {
    onChange({ h: hsv.h, s: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100), v: clamp(100 - ((event.clientY - rect.top) / rect.height) * 100, 0, 100) });
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 10 : 1;
    const s = Math.round(hsv.s);
    const v = Math.round(hsv.v);
    const moves: Record<string, Hsv> = {
      ArrowRight: { ...hsv, s: clamp(s + step, 0, 100) },
      ArrowLeft: { ...hsv, s: clamp(s - step, 0, 100) },
      ArrowUp: { ...hsv, v: clamp(v + step, 0, 100) },
      ArrowDown: { ...hsv, v: clamp(v - step, 0, 100) },
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      role="slider"
      dir="ltr"
      tabIndex={0}
      aria-label={__('Saturation and brightness', 'fyldo')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(hsv.s)}
      aria-valuetext={sprintf(__('Saturation %1$s, brightness %2$s', 'fyldo'), percent(Math.round(hsv.s), locale), percent(Math.round(hsv.v), locale))}
      data-slot="fy-color-area"
      onKeyDown={onKeyDown}
      {...drag}
      className="fy:relative fy:h-40 fy:w-full fy:shrink-0 fy:cursor-crosshair fy:touch-none fy:overflow-hidden fy:rounded-sm fy:outline-none"
      style={{
        backgroundColor: hueColor(hsv.h),
        backgroundImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 0), #000000), linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0))',
      }}
    >
      <span aria-hidden="true" className={THUMB} style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: current }} />
    </div>
  );
}

/** Hue 0–360 across a 12px strip. Also left to right in Persian. */
function Hue({ hsv, locale, onChange }: { hsv: Hsv; locale: string; onChange: (next: Hsv) => void }): ReactElement {
  const drag = useDrag((event, rect) => {
    onChange({ ...hsv, h: clamp(((event.clientX - rect.left) / rect.width) * 360, 0, 360) });
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? 10 : 1;
    const h = Math.round(hsv.h);
    const hues: Record<string, number> = { ArrowRight: h + step, ArrowUp: h + step, ArrowLeft: h - step, ArrowDown: h - step, Home: 0, End: 360 };
    const next = hues[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onChange({ ...hsv, h: clamp(next, 0, 360) });
  };

  return (
    <div
      role="slider"
      dir="ltr"
      tabIndex={0}
      aria-label={__('Hue', 'fyldo')}
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hsv.h)}
      aria-valuetext={`${formatNumber(Math.round(hsv.h), locale)}°`}
      data-slot="fy-color-hue"
      onKeyDown={onKeyDown}
      {...drag}
      className="fy:relative fy:h-4 fy:w-full fy:shrink-0 fy:cursor-pointer fy:touch-none fy:outline-none"
    >
      <span
        aria-hidden="true"
        className="fy:absolute fy:inset-x-0 fy:top-1/2 fy:h-3 fy:-translate-y-1/2 fy:rounded-full"
        style={{ backgroundImage: 'linear-gradient(to right, #ff0000, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000)' }}
      />
      <span aria-hidden="true" className={cn(THUMB, 'fy:top-1/2')} style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor(hsv.h) }} />
    </div>
  );
}

/** The hex row: a 32px preview and the Small Input. Typing commits as soon as the text is a colour; anything else is put back on blur. */
function HexRow({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="fy:flex fy:items-center fy:gap-2">
      <span
        aria-hidden="true"
        data-slot="fy-color-preview"
        className={cn(
          'fy:box-border fy:size-8 fy:shrink-0 fy:rounded-sm fy:border',
          value === '' ? 'fy:border-dashed fy:border-border-strong' : 'fy:border-border-default',
        )}
        style={{ backgroundColor: value === '' ? undefined : value }}
      />
      <Field.Root className="fy:min-w-0 fy:flex-1">
        <Input
          size="sm"
          ltr
          aria-label={__('Hex color', 'fyldo')}
          placeholder="#RRGGBB"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="off"
          value={draft ?? value.toUpperCase()}
          onValueChange={(text) => {
            setDraft(text);
            const parsed = parseHex(text);
            if (parsed !== null) onValueChange(parsed);
          }}
          onBlur={() => {
            // An empty box clears the colour; text that is not a colour goes back to the last valid one.
            if (draft !== null && draft.trim() === '' && value !== '') onValueChange('');
            setDraft(null);
          }}
        />
      </Field.Root>
    </div>
  );
}

/** The preset swatches: one tab stop (roving tabindex); arrows move focus, Enter / Space choose. */
function Presets({ presets, value, onSelect }: { presets: readonly string[]; value: string; onSelect: (hex: string) => void }): ReactElement {
  const direction = useDirection();
  const labelId = useId();
  const selected = presets.indexOf(value);
  // The tab stop is the focused swatch while focus is inside, else the chosen colour (else the first).
  const [focused, setFocused] = useState<number | null>(null);
  const active = focused ?? Math.max(0, selected);
  const items = useRef<Array<HTMLButtonElement | null>>([]);

  const focusAt = (index: number): void => {
    const next = clamp(index, 0, presets.length - 1);
    setFocused(next);
    items.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const toEnd = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const toStart = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const target: Record<string, number> = {
      [toEnd]: active + 1,
      [toStart]: active - 1,
      ArrowDown: active + PRESET_COLUMNS,
      ArrowUp: active - PRESET_COLUMNS,
      Home: 0,
      End: presets.length - 1,
    };
    const next = target[event.key];
    if (next === undefined) return;
    event.preventDefault();
    focusAt(next);
  };

  return (
    <div className="fy:flex fy:flex-col fy:gap-2" data-slot="fy-color-presets">
      <span id={labelId} className="fy:text-label-13 fy:text-text-secondary">
        {__('Presets', 'fyldo')}
      </span>
      {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tabindex: the group itself is not a tab stop, exactly one radio inside it is */}
      <div role="radiogroup" aria-labelledby={labelId} onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(null);
        }}
        className="fy:flex fy:flex-wrap fy:gap-2"
      >
        {presets.map((hex, index) => (
          <ColorSwatch
            key={hex}
            ref={(node) => {
              items.current[index] = node;
            }}
            role="radio"
            color={hex}
            selected={hex === value}
            aria-checked={hex === value}
            tabIndex={index === active ? 0 : -1}
            onFocus={() => setFocused(index)}
            onClick={() => onSelect(hex)}
          />
        ))}
      </div>
    </div>
  );
}

export interface ColorPickerPanelProps {
  /** `#rrggbb`, or '' for no colour yet. */
  value: string;
  onValueChange: (value: string) => void;
  /** Hex list shown under the hex row; `false` hides the section. */
  presets?: readonly string[] | false;
  /** Numerals of the spoken values (۸۱٪ in Persian). */
  locale?: string;
  className?: string;
}

/**
 * Figma "Color Picker Panel" (280 wide): Area, Hue strip, Hex row, Presets. No alpha, no eyedropper. It holds the colour
 * as HSV while it is open, so dragging through grey or black does not lose the hue.
 */
export function ColorPickerPanel({ value, onValueChange, presets = DEFAULT_PRESETS, locale = 'en', className }: ColorPickerPanelProps): ReactElement {
  const [hsv, setHsv] = useState<Hsv>(() => (value === '' ? { h: 0, s: 0, v: 100 } : hexToHsv(value)));
  const [seen, setSeen] = useState(value);

  // A colour set from outside (a preset, the hex box, a reset) moves the thumbs; our own moves already match.
  if (value !== seen) {
    setSeen(value);
    if (value !== '' && value !== hsvToHex(hsv)) setHsv(hexToHsv(value));
  }

  const commit = (next: Hsv): void => {
    setHsv(next);
    const hex = hsvToHex(next);
    setSeen(hex);
    onValueChange(hex);
  };

  const shown = value === '' ? '#ffffff' : value;

  return (
    <div
      data-slot="fy-color-picker-panel"
      className={cn(
        'fy:box-border fy:flex fy:w-70 fy:flex-col fy:gap-3 fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:p-3 fy:text-text-primary fy:shadow-medium',
        className,
      )}
    >
      <Area hsv={hsv} current={shown} locale={locale} onChange={commit} />
      <Hue hsv={hsv} locale={locale} onChange={commit} />
      <HexRow value={value} onValueChange={onValueChange} />
      {presets !== false && presets.length > 0 ? <Presets presets={presets} value={value} onSelect={onValueChange} /> : null}
    </div>
  );
}
