import type { ReactElement } from 'react';
import { MediaField, type MediaFieldProps } from './media-field';

export type SelectFileFieldProps = Omit<MediaFieldProps, 'kind'>;

/** Figma "Select File": one file from the WordPress media library, with a file tile, its name, type and size. */
export function SelectFileField(props: SelectFileFieldProps): ReactElement {
  return <MediaField {...props} kind="file" />;
}
