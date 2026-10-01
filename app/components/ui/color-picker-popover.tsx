import { Popover } from '@base-ui/react/popover';
import type { ReactElement, RefObject } from 'react';
import { __ } from '../../i18n';
import { usePortalContainer } from '../../lib/portal';
import { ColorPickerPanel, type ColorPickerPanelProps } from './color-picker-panel';

export interface ColorPickerPopoverProps extends ColorPickerPanelProps {
  open: boolean;
  /** Closing by Esc, an outside press or focus leaving. */
  onOpenChange: (open: boolean, details: Popover.Root.ChangeEventDetails) => void;
  /** The field's control: the panel opens 4px below it, and focus goes back to it on close. */
  anchorRef: RefObject<HTMLElement | null>;
}

/**
 * The lazily loaded half of the Color Picker (this module, the panel and Base UI's Popover are a separate chunk, so the
 * main bundle stays small). A non-modal Popover anchored under the field's control, at its start edge.
 */
export default function ColorPickerPopover({ open, onOpenChange, anchorRef, ...panel }: ColorPickerPopoverProps): ReactElement {
  const container = usePortalContainer();

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Portal container={container ?? undefined}>
        <Popover.Positioner anchor={anchorRef} side="bottom" align="start" sideOffset={4} className="fy:z-50 fy:outline-none">
          <Popover.Popup aria-label={__('Color picker', 'fyldo')} finalFocus={anchorRef} data-slot="fy-color-picker-popup" className="fy:outline-none">
            <ColorPickerPanel {...panel} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
