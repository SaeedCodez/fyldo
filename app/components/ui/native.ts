import type { AriaAttributes, ClipboardEventHandler, CSSProperties, HTMLAttributes, Ref } from 'react';

/** Every `aria-*` attribute. (An alias: the d.ts bundler cannot write a React type straight after `extends`.) */
type Aria = Pick<AriaAttributes, keyof AriaAttributes>;

/**
 * The native attributes a control's public props pass on to its element, named one by one. The props of the SDK's
 * components (app/sdk-types.ts) are Fyldo's own: they never extend a library's (Base UI's `render`, `nativeButton`,
 * a `className` function of its state, the `details` of its callbacks), which would freeze that library into v1.
 */
export interface NativeAttributes<E extends Element>
  extends Aria,
    Pick<HTMLAttributes<E>, 'id' | 'title' | 'tabIndex' | 'autoFocus' | 'onFocus' | 'onBlur' | 'onKeyDown' | 'onKeyUp'> {
  className?: string;
  style?: CSSProperties;
  ref?: Ref<E>;
}

/** What a text control passes on to its `<input>` or `<textarea>` as well. */
export interface TextAttributes<E extends HTMLInputElement | HTMLTextAreaElement> extends NativeAttributes<E> {
  value?: string;
  defaultValue?: string;
  /** The new text; one argument. */
  onValueChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  autoComplete?: string;
  spellCheck?: boolean;
  autoCapitalize?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  onPaste?: ClipboardEventHandler<E>;
}
