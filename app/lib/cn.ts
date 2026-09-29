import { clsx, type ClassValue } from 'clsx';

/**
 * Class composition. Deliberately `clsx` only (no tailwind-merge): utilities are prefixed (`fy:`) and use custom
 * text-style/token names that tailwind-merge does not know, so components compose variants without overriding.
 */
export const cn = (...inputs: ClassValue[]): string => clsx(inputs);
