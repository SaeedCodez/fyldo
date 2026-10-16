import { Popover } from '@base-ui/react/popover';
import { useRef, type ReactElement, type ReactNode, type RefObject } from 'react';
import { usePortalContainer } from '../../lib/portal';
import { CalendarPanel, type CalendarPanelProps } from './calendar-panel';
import { TimePanel, type TimePanelProps } from './time-panel';

interface ShellProps {
  open: boolean;
  /** Closing by Esc, an outside press or focus leaving. */
  onOpenChange: (open: boolean, details: Popover.Root.ChangeEventDetails) => void;
  /** The field's box: the panel opens 4px below it, at its start edge. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Focus goes back here on close (the field's control). */
  returnFocusRef: RefObject<HTMLElement | null>;
  label: string;
  /** What takes focus on open, inside the panel. */
  focusSelector: string;
  slot: string;
  children: ReactNode;
}

/** A non-modal dialog (WAI-ARIA date picker dialog) anchored under the field, rendered inside the Fyldo root. */
function Shell({ open, onOpenChange, anchorRef, returnFocusRef, label, focusSelector, slot, children }: ShellProps): ReactElement {
  const container = usePortalContainer();
  const popup = useRef<HTMLDivElement | null>(null);

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Portal container={container ?? undefined}>
        <Popover.Positioner anchor={anchorRef} side="bottom" align="start" sideOffset={4} className="fy:z-50 fy:outline-none">
          <Popover.Popup
            ref={popup}
            aria-label={label}
            initialFocus={() => popup.current?.querySelector<HTMLElement>(focusSelector) ?? true}
            finalFocus={returnFocusRef}
            data-slot={slot}
            className="fy:outline-none"
          >
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

type PopoverProps = Omit<ShellProps, 'children' | 'focusSelector' | 'slot'>;

/**
 * The lazily loaded half of the date and datetime fields: the Calendar Panel in its popup (this module, the panels and Base
 * UI's Popover are a separate chunk, so the main bundle stays small). Focus starts on the selected day (or today).
 */
export function CalendarPopover({ open, onOpenChange, anchorRef, returnFocusRef, label, ...panel }: PopoverProps & CalendarPanelProps): ReactElement {
  return (
    <Shell open={open} onOpenChange={onOpenChange} anchorRef={anchorRef} returnFocusRef={returnFocusRef} label={label} focusSelector="[data-active-cell]" slot="fy-calendar-popup">
      <CalendarPanel {...panel} />
    </Shell>
  );
}

/** The time field's popup: the Time Panel with "Now". Focus starts on the hour. */
export function TimePopover({ open, onOpenChange, anchorRef, returnFocusRef, label, ...panel }: PopoverProps & TimePanelProps): ReactElement {
  return (
    <Shell
      open={open}
      onOpenChange={onOpenChange}
      anchorRef={anchorRef}
      returnFocusRef={returnFocusRef}
      label={label}
      focusSelector='[data-slot="fy-time-column"] [tabindex="0"]'
      slot="fy-time-popup"
    >
      <TimePanel {...panel} type="popup" />
    </Shell>
  );
}
