import { useEffect, useState, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Input, type InputProps } from './input';
import { Tooltip } from './tooltip';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'suffix'> {
  /** Hides the text again whenever this changes (the page's revision: after a successful save). */
  hideOn?: unknown;
}

/**
 * A password Input with a show/hide toggle — CODE-ONLY design, approved by the owner, not in Figma yet
 * (docs/design-spec.md "Code-only design"). The toggle sits in the Input's suffix icon slot (16px, 8px after the
 * text, inside the 12px end padding): a real button named "Show password" whose `aria-pressed` carries the state, `eye` while hidden / `eye-slash` while shown, `icon/secondary`
 * (`icon/primary` on hover), the neutral focus ring, a 24×24 target. It only reveals what the user typed — a stored
 * secret is never in the browser (the field is empty with the "•••• set" placeholder). Hidden again after a
 * successful save (`hideOn`) and on a page change (the page remounts); disabled with the field.
 */
export function PasswordInput({ hideOn, disabled, ...props }: PasswordInputProps): ReactElement {
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(false), [hideOn]);

  return (
    <Input
      {...props}
      disabled={disabled}
      type={shown ? 'text' : 'password'}
      suffix={
        // Design rule 10: an icon-only button says what it does — the tooltip repeats its (fixed) name.
        <Tooltip label={__('Show password', 'fyldo')}>
          <button
            type="button"
            data-slot="fy-password-toggle"
            // One fixed name; `aria-pressed` says whether the text is shown ("Show password, pressed").
            aria-label={__('Show password', 'fyldo')}
            aria-pressed={shown}
            disabled={disabled}
            onClick={() => setShown((s) => !s)}
            className="fy:relative fy:inline-flex fy:size-4 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-xs fy:text-icon-secondary fy:transition-colors fy:duration-100 fy:ease-out fy:hover:text-icon-primary fy:focus-ring fy:disabled:cursor-not-allowed fy:disabled:text-text-disabled fy:disabled:hover:text-text-disabled fy:before:absolute fy:before:-inset-1"
          >
            <Icon name={shown ? 'eye-slash' : 'eye'} size={16} />
          </button>
        </Tooltip>
      }
    />
  );
}
