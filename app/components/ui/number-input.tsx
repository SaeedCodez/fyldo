import { useEffect, useState, type ReactElement } from 'react';
import { sanitizeNumber } from '../../lib/digits';
import { Input, type InputProps } from './input';

export interface NumberInputProps extends Omit<InputProps, 'value' | 'defaultValue' | 'onValueChange' | 'type' | 'inputMode' | 'ltr' | 'digits'> {
  /** The value the form holds: a number, `''` (nothing), or text that is not (yet) a number. */
  value: number | string;
  onValueChange: (next: number | string) => void;
}

/**
 * Number field control: a text input with `inputmode="decimal"` (a real `type="number"` refuses Persian digits and
 * fights the caret), always LTR (a minus sign or a decimal point must not jump sides in an RTL layout). It shows what
 * was typed, so "1." and "-" survive while the user is mid-way, but reports what a number makes of it: the form
 * never holds Persian digits, and text that is not a number stays text so the `number` rule can say so.
 */
export function NumberInput({ value, onValueChange, ...input }: NumberInputProps): ReactElement {
  const [text, setText] = useState(String(value));

  // A change that did not come from typing (Discard, a save, a conflict reload) replaces the text.
  useEffect(() => {
    setText((current) => (Object.is(sanitizeNumber(current), value) ? current : String(value)));
  }, [value]);

  return (
    <Input
      {...input}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      ltr
      digits
      value={text}
      onValueChange={(next) => {
        setText(next);
        onValueChange(sanitizeNumber(next));
      }}
    />
  );
}
