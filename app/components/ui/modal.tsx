// from shadcn base-nova dialog @2026-09-30, restyled for Fyldo (Base UI Dialog; Figma "Modal", Type=Default)
import { Dialog } from '@base-ui/react/dialog';
import { useEffect, useRef, type ReactElement } from 'react';
import { __ } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { usePortalContainer } from '../../lib/portal';
import { Button } from './button';

export interface ModalProps {
  open: boolean;
  /** Called with `false` when the modal asks to close: Esc, the close button, a click on the backdrop, or Cancel. */
  onOpenChange: (open: boolean) => void;
  /** A question that names the action ("Discard unsaved changes?"). */
  title: string;
  description?: string;
  /** Secondary Small, at the start of the footer. */
  cancelLabel: string;
  /** Primary Small, at the end of the footer; repeats the verb of the title — never "OK". */
  confirmLabel: string;
  onConfirm: () => void;
  /** Where focus goes once the modal has closed after Confirm (e.g. the heading of the page it led to). Default: stays put. */
  focusAfterConfirm?: () => HTMLElement | null;
}

/**
 * Figma "Modal", Type=Default (the Danger type, typed confirmation and a running `pending` state are Milestone 4):
 * 480 wide (at most the viewport − 32px), radius lg, 1px `border/default`, `Shadow/Large`, over a
 * `background/overlay` scrim. Header 24 all round, gap 16: title (Heading/20) + description (Copy/14
 * `text/secondary`), gap 8 · the close Icon Button (Tertiary Small, `close-circle`). Footer on `background/subtle`
 * with a top border, 16/24: Cancel at the start, Confirm at the end (mirrored in RTL).
 *
 * Closes on Esc, the close button and a backdrop click (design rule 9). Focus moves in (to Cancel: the safe choice),
 * is trapped, the page behind is inert, and focus returns to the trigger on close — except after Confirm, whose
 * action decides where focus goes next (e.g. the next page's heading). Portals into the Fyldo root.
 */
export function Modal({ open, onOpenChange, title, description, cancelLabel, confirmLabel, onConfirm, focusAfterConfirm }: ModalProps): ReactElement {
  const container = usePortalContainer();
  const popup = useRef<HTMLDivElement>(null);
  const confirmed = useRef(false);
  // Reset when it opens (not when it closes: `finalFocus` reads it after the close).
  useEffect(() => {
    if (open) confirmed.current = false;
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Backdrop
          data-slot="fy-modal-backdrop"
          className="fy:fixed fy:inset-0 fy:z-50 fy:bg-background-overlay fy:transition-opacity fy:duration-150 fy:ease-out fy:data-starting-style:opacity-0 fy:data-ending-style:opacity-0 fy:motion-reduce:transition-none"
        />
        <Dialog.Viewport className="fy:fixed fy:inset-0 fy:z-50 fy:flex fy:items-center fy:justify-center fy:p-4">
          <Dialog.Popup
            data-slot="fy-modal"
            data-type="default"
            ref={popup}
            initialFocus={() => popup.current?.querySelector<HTMLElement>('[data-modal-cancel]') ?? true}
            finalFocus={() => (confirmed.current ? (focusAfterConfirm?.() ?? false) : true)}
            className="fy:flex fy:w-120 fy:max-w-full fy:flex-col fy:overflow-hidden fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:shadow-large fy:outline-none fy:transition fy:duration-150 fy:ease-out fy:data-starting-style:scale-98 fy:data-starting-style:opacity-0 fy:data-ending-style:scale-98 fy:data-ending-style:opacity-0 fy:motion-reduce:transition-none"
          >
            <div className="fy:flex fy:items-start fy:gap-4 fy:p-6">
              <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-2">
                <Dialog.Title className="fy:text-heading-20 fy:text-text-primary">{title}</Dialog.Title>
                {description ? <Dialog.Description className="fy:text-copy-14 fy:text-text-secondary">{description}</Dialog.Description> : null}
              </div>
              {/* Figma Icon Button Tertiary Small. Its Tooltip (design rule 10) arrives with the Tooltip in Milestone 4. */}
              <Dialog.Close
                aria-label={__('Close', 'fyldo')}
                data-slot="fy-modal-close"
                className="fy:inline-flex fy:size-8 fy:shrink-0 fy:items-center fy:justify-center fy:rounded-sm fy:text-text-primary fy:transition-colors fy:duration-100 fy:ease-out fy:hover:bg-action-tertiary-hover fy:focus-ring"
              >
                <Icon name="close-circle" size={16} />
              </Dialog.Close>
            </div>
            <div className="fy:flex fy:items-center fy:justify-between fy:gap-4 fy:border-t fy:border-border-default fy:bg-background-subtle fy:px-6 fy:py-4">
              <Button data-modal-cancel variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
                {cancelLabel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  confirmed.current = true;
                  onConfirm();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
