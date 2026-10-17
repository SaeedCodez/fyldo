import { createContext, useContext } from 'react';
import type { FormDef } from '../types';
import type { RecordsApi } from './api';

/** What a `<Form>` needs from the app around it: the plugin's forms (from the config), their REST routes and the locale. */
export interface FormHost {
  forms: FormDef[];
  api: RecordsApi;
  locale: string;
}

export const FormHostContext = createContext<FormHost | null>(null);

export const useFormHost = (): FormHost | null => useContext(FormHostContext);
