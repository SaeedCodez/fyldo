import { Radio as BaseRadio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { useId, type FocusEvent, type ReactElement } from 'react';
import { cn } from '../../lib/cn';
import { useGroupLabels } from './group-field';

/** What the cards show: a 16:10 image and text, the image alone, or text alone. */
export type ChoiceCardContent = 'image_text' | 'image' | 'text';

export interface ChoiceCardOption {
  value: string;
  /** Names the card, also when only the image is shown. */
  label: string;
  description?: string;
  /** URL of the preview picture (`image_text` and `image` cards). */
  image?: string;
  disabled?: boolean;
}

/*
 * Figma Choice Card: `radius/md`, `background/default`, 1px `border/input` + 1px padding (Checked: 2px `focus/border`, no
 * padding, so the height never jumps). Hover darkens the border (`border/input-hover`); focus = `focus/border` plus the
 * neutral ring. Disabled = `background/subtle`, `border/default` (checked: `border/strong`). The check badge is a 20px
 * `control/on` circle 8px from the top end corner. Image is 16:10 and follows the card width; Footer is padding 12, gap 2,
 * a 1px top divider; Text only has padding 16 and 44 at the end so the badge never overlaps the text.
 */
const CARD = [
  'fy:group/card fy:relative fy:flex fy:min-w-0 fy:cursor-pointer fy:flex-col fy:overflow-hidden fy:rounded-md fy:border fy:border-border-input',
  'fy:bg-background-default fy:p-px fy:text-start fy:transition-colors fy:duration-100 fy:ease-out',
  'fy:data-unchecked:hover:border-border-input-hover',
  'fy:data-checked:border-2 fy:data-checked:border-focus-border fy:data-checked:p-0',
  'fy:focus-visible:border-focus-border',
  'fy:data-disabled:cursor-not-allowed fy:data-disabled:border-border-default fy:data-disabled:bg-background-subtle',
  'fy:data-disabled:data-unchecked:hover:border-border-default',
  'fy:data-disabled:data-checked:border-border-strong',
  'fy:focus-ring',
].join(' ');

const BADGE = [
  'fy:absolute fy:end-1.5 fy:top-1.5 fy:flex fy:size-5 fy:items-center fy:justify-center fy:rounded-full',
  'fy:bg-control-on fy:text-text-inverse fy:group-data-[disabled]/card:bg-control-on-disabled',
].join(' ');

const TICK = (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {/* Figma: Tick 10×7.5 centred in the 20px badge */}
    <path d="M5.5 10.9L8.5 13.4L14.6 6.6" />
  </svg>
);

export interface ChoiceCardProps {
  option: ChoiceCardOption;
  content: ChoiceCardContent;
  disabled?: boolean;
}

/** One card: a Base UI radio (role `radio`, visually hidden input) drawn as a card. Must be inside a `ChoiceCards` (a radio group). */
export function ChoiceCard({ option, content, disabled }: ChoiceCardProps): ReactElement {
  const labelId = useId();
  const descriptionId = useId();
  const showImage = content !== 'text';
  const showText = content !== 'image';
  const description = showText ? option.description : undefined;

  return (
    <BaseRadio.Root
      value={option.value}
      disabled={disabled || option.disabled}
      data-slot="fy-choice-card"
      // Image only has no text to take the name from: the label stays as the name, the picture is decoration.
      aria-label={showText ? undefined : option.label}
      aria-labelledby={showText ? labelId : undefined}
      aria-describedby={description ? descriptionId : undefined}
      className={CARD}
    >
      {showImage ? (
        <img src={option.image} alt="" draggable={false} data-slot="fy-choice-card-image" className="fy:block fy:aspect-16/10 fy:w-full fy:bg-border-default fy:object-cover fy:group-data-[disabled]/card:opacity-50" />
      ) : null}
      {showText ? (
        <span
          data-slot="fy-choice-card-footer"
          className={cn('fy:flex fy:flex-col fy:gap-0.5', showImage ? 'fy:border-t fy:border-border-default fy:p-3' : 'fy:py-4 fy:ps-4 fy:pe-11')}
        >
          <span id={labelId} className="fy:text-label-13-strong fy:text-text-primary fy:group-data-[disabled]/card:text-text-disabled">
            {option.label}
          </span>
          {description ? (
            <span id={descriptionId} className="fy:text-copy-13 fy:text-text-secondary fy:group-data-[disabled]/card:text-text-disabled">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
      <BaseRadio.Indicator data-slot="fy-choice-card-check" className={BADGE}>
        {TICK}
      </BaseRadio.Indicator>
    </BaseRadio.Root>
  );
}

/*
 * Columns: 2 (default), 3 or 4 across the 576px group; up to 782px (WordPress goes mobile) at most 2, up to 480px one.
 * Grid cells follow the reading direction, so in Persian each row runs right to left and a wrapped row starts on the right.
 */
const COLUMNS = {
  2: 'fy:grid-cols-2 fy:narrow:grid-cols-1',
  3: 'fy:grid-cols-3 fy:wp-mobile:grid-cols-2 fy:narrow:grid-cols-1',
  4: 'fy:grid-cols-4 fy:wp-mobile:grid-cols-2 fy:narrow:grid-cols-1',
} as const;

export interface ChoiceCardsProps {
  options: ChoiceCardOption[];
  content: ChoiceCardContent;
  columns?: 2 | 3 | 4;
  /** The selected option's `value`; `''` = nothing selected. */
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
  /** Focus left the group (bubbled `blur`; the caller decides whether it moved between cards). */
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

/**
 * The wrapping list of cards (Figma "Options": gap 12). A radio group underneath: `role="radiogroup"`, Tab enters, the
 * arrow keys move the choice (mirrored in RTL), Space selects. Inside a Setting Row the row names it.
 */
export function ChoiceCards({ options, content, columns = 2, value, onValueChange, disabled, name, className, ...aria }: ChoiceCardsProps): ReactElement {
  const labels = useGroupLabels();
  return (
    <BaseRadioGroup
      {...labels}
      {...aria}
      value={value}
      name={name}
      disabled={disabled}
      data-slot="fy-choice-cards"
      onValueChange={(next) => onValueChange(String(next))}
      className={cn('fy:grid fy:w-full fy:gap-3', COLUMNS[columns], className)}
    >
      {options.map((option) => (
        <ChoiceCard key={option.value} option={option} content={content} disabled={disabled} />
      ))}
    </BaseRadioGroup>
  );
}
