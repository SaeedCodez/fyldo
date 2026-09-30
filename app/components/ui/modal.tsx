// from shadcn base-nova dialog + alert-dialog @2026-09-30, restyled for Fyldo (Base UI Dialog / AlertDialog; Figma "Modal")
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { __, sprintf } from '../../i18n';
import { cn } from '../../lib/cn';
import { usePortalContainer } from '../../lib/portal';
import { Button } from './button';
import { IconButton } from './icon-button';
import { TextField } from './text-field';

export interface ModalProps {
  open: boolean;
  /** Called with `false` when the modal asks to close: Esc, the close button, a click on the backdrop (Default only), or Cancel. Esc is Cancel: it never confirms. */
  onOpenChange: (open: boolean) => void;
  /** Figma `Type`. Default: a confirmation that discards work. Danger: an irreversible action, with an Error button. */
  type?: 'default' | 'danger';
  /** A question that names the action ("Discard unsaved changes?", "Reset all settings?"). */
  title: string;
  description?: string;
  /** Secondary Small, at the start of the footer. */
  cancelLabel: string;
  /** At the end of the footer (Primary; Error in a Danger modal); repeats the verb of the title — never "OK". */
  confirmLabel: string;
  /**
   * Runs on Confirm. Return a promise for an action that takes time: the modal then shows it running (Confirm loading,
   * Cancel and the close button disabled) and cannot be closed until it settles. The caller closes the modal when the
   * action is done; if the action failed and the modal should stay, just do not close it.
   */
  onConfirm: () => void | Promise<void>;
  /**
   * Danger only, for high-impact actions: the words the user must type before Confirm is enabled (case-sensitive,
   * surrounding spaces ignored). It is checked again on the server.
   */
  confirmKeyword?: string;
  /** Where focus goes once the modal has closed after Confirm (e.g. the heading of the page it led to). Default: stays put. */
  focusAfterConfirm?: () => HTMLElement | null;
}

/**
 * Figma "Modal": 480 wide (at most the viewport − 32px), radius lg, 1px `border/default`, `Shadow/Large`, over a
 * `background/overlay` scrim. Header 24 all round, gap 16: title (Heading/20) + description (Copy/14
 * `text/secondary`), gap 8 · the close Icon Button (Tertiary Small, `close-circle`, with its Tooltip). Footer on
 * `background/subtle` with a top border, 16/24: Cancel (Secondary Small) at the start, Confirm at the end (mirrored in RTL).
 *
 * Type=Danger adds the typed confirmation (a labelled Medium Input in a Body, header padding 24/24/16/24) and an Error
 * Small Confirm that stays disabled until the keyword matches. A Danger modal closes through Cancel, the close button
 * or Esc (Esc is Cancel: it never confirms) — not a click on the scrim — and never while its action is running (design
 * rule 9). A Default one also closes on the scrim.
 *
 * Focus moves in on open — to Cancel, the safe choice, or to the keyword field — is trapped, the page behind is inert,
 * and focus returns to the trigger on close, except after Confirm, whose action decides where focus goes next (e.g.
 * the next page's heading). Portals into the Fyldo root.
 */
export function Modal({ open, onOpenChange, type = 'default', title, description, cancelLabel, confirmLabel, onConfirm, confirmKeyword, focusAfterConfirm }: ModalProps): ReactElement {
  const container = usePortalContainer();
  const popup = useRef<HTMLDivElement>(null);
  const confirmed = useRef(false);
  const mounted = useRef(true);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const danger = type === 'danger';
  const keyword = danger ? (confirmKeyword ?? '').trim() : '';
  const matches = keyword === '' || typed.trim() === keyword;
  const D = (danger ? AlertDialog : Dialog) as typeof Dialog;

  // Reset when it opens (not when it closes: `finalFocus` reads `confirmed` after the close).
  useEffect(() => {
    if (open) {
      confirmed.current = false;
      setTyped('');
    }
  }, [open]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const confirm = async (): Promise<void> => {
    if (busy || !matches) return;
    confirmed.current = true;
    const result = onConfirm();
    if (result instanceof Promise) {
      setBusy(true);
      try {
        await result;
      } finally {
        if (mounted.current) setBusy(false);
      }
    }
  };

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    void confirm();
  };

  return (
    <D.Root
      open={open}
      onOpenChange={(next, details) => {
        if (busy) return; // never while the action is running
        // A Danger modal ignores a click on the scrim (a stray click must not dismiss it); Esc is Cancel.
        if (danger && !next && details.reason === 'outside-press') return;
        onOpenChange(next);
      }}
    >
      <D.Portal container={container ?? undefined}>
        <D.Backdrop
          data-slot="fy-modal-backdrop"
          className="fy:fixed fy:inset-0 fy:z-50 fy:bg-background-overlay fy:transition-opacity fy:duration-150 fy:ease-out fy:data-starting-style:opacity-0 fy:data-ending-style:opacity-0 fy:motion-reduce:transition-none"
        />
        <D.Viewport className="fy:fixed fy:inset-0 fy:z-50 fy:flex fy:items-center fy:justify-center fy:p-4">
          <D.Popup
            data-slot="fy-modal"
            data-type={type}
            ref={popup}
            initialFocus={() =>
              popup.current?.querySelector<HTMLElement>(keyword ? '[data-modal-keyword]' : '[data-modal-cancel]') ?? true
            }
            finalFocus={() => (confirmed.current ? (focusAfterConfirm?.() ?? false) : true)}
            className="fy:flex fy:w-120 fy:max-w-full fy:flex-col fy:overflow-hidden fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:shadow-large fy:outline-none fy:transition fy:duration-150 fy:ease-out fy:data-starting-style:scale-98 fy:data-starting-style:opacity-0 fy:data-ending-style:scale-98 fy:data-ending-style:opacity-0 fy:motion-reduce:transition-none"
          >
            <form onSubmit={submit} noValidate className="fy:flex fy:flex-col">
              <div className={cn('fy:flex fy:items-start fy:gap-4 fy:px-6 fy:pt-6', keyword ? 'fy:pb-4' : 'fy:pb-6')}>
                <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-2">
                  <D.Title className="fy:text-heading-20 fy:text-text-primary">{title}</D.Title>
                  {description ? <D.Description className="fy:text-copy-14 fy:text-text-secondary">{description}</D.Description> : null}
                </div>
                {/* Figma Icon Button Tertiary Small: its Tooltip repeats its name (design rule 10). */}
                <IconButton icon="close-circle" label={__('Close', 'fyldo')} data-slot="fy-modal-close" disabled={busy} onClick={() => onOpenChange(false)} />
              </div>
              {keyword ? (
                <div className="fy:px-6 fy:pb-6">
                  {/* Figma "Confirmation": a labelled Medium Input whose placeholder is the keyword itself. */}
                  <TextField
                    label={sprintf(__('Type %s to confirm', 'fyldo'), keyword)}
                    placeholder={keyword}
                    size="md"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    disabled={busy}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-modal-keyword
                  />
                </div>
              ) : null}
              <div className="fy:flex fy:items-center fy:justify-between fy:gap-4 fy:border-t fy:border-border-default fy:bg-background-subtle fy:px-6 fy:py-4">
                <Button data-modal-cancel type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
                  {cancelLabel}
                </Button>
                <Button type="submit" variant={danger ? 'error' : 'primary'} size="sm" loading={busy} disabled={!matches}>
                  {confirmLabel}
                </Button>
              </div>
            </form>
          </D.Popup>
        </D.Viewport>
      </D.Portal>
    </D.Root>
  );
}
