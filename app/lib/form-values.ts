import { createContext, useContext } from 'react';
import type { FieldValue } from '../types';

/**
 * Every field's current value on the form being drawn (FormBody: a settings page, or a `<Form>`), with the person's edits
 * and the defaults of fields the stored values do not hold. A custom field's `watch` reads it.
 */
export const FormValuesContext = createContext<Readonly<Record<string, FieldValue>>>({});

export const useFormValues = (): Readonly<Record<string, FieldValue>> => useContext(FormValuesContext);
