import { createContext, useContext } from 'react';
import type { FieldValue } from '../types';
import { ALL_VISIBLE, type Visibility } from './dependency';

/**
 * Every field's current value on the form being drawn (FormBody: a settings page, or a `<Form>`), with the person's edits
 * and the defaults of fields the stored values do not hold. A custom field's `watch` reads it; inside a group item it
 * holds that item's sub-field values instead (FieldGroup).
 */
export const FormValuesContext = createContext<Readonly<Record<string, FieldValue>>>({});

export const useFormValues = (): Readonly<Record<string, FieldValue>> => useContext(FormValuesContext);

/** What the form's `dependency` conditions show right now (FormBody); a group reads it for its items' sub-fields. */
export const FormVisibilityContext = createContext<Visibility>(ALL_VISIBLE);

export const useFormVisibility = (): Visibility => useContext(FormVisibilityContext);
