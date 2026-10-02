import type { ReactElement } from 'react';
import { MediaField, type MediaFieldProps } from './media-field';

export type UploadImageFieldProps = Omit<MediaFieldProps, 'kind'>;

/** Figma "Upload Image": one image from the WordPress media library, with a thumbnail, its name and size. */
export function UploadImageField(props: UploadImageFieldProps): ReactElement {
  return <MediaField {...props} kind="image" />;
}
