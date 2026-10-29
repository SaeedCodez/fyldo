/**
 * The public types of a developer's module (a custom field or a custom page): what its default export receives and
 * returns. `npm run types` bundles this entry into assets/dist/fyldo-sdk.d.ts (tools/types/build.ts), which ships in the
 * release, so a plugin or theme can write its modules in TypeScript (docs/custom-fields.md#typescript). Only React's
 * types stay an import (`@types/react` in the consumer); everything else is inlined. This is the 1.x contract: a name
 * exported here stays, a member is only ever added, and an addition after 1.0 carries `@since` in its doc comment.
 */
export type { FyldoSdk } from './lib/sdk';
export type {
  CustomFieldDefinition,
  CustomFieldExport,
  CustomFieldMountHandle,
  CustomFieldProps,
  CustomFieldValidateContext,
} from './lib/custom-fields';
export type {
  CustomPageDefinition,
  CustomPageExport,
  CustomPageMountHandle,
  CustomPageProps,
} from './lib/custom-pages';
export type { DateRangeValue, FieldValue, JsonValue, MediaItem } from './types';
export type { RequestOptions } from './lib/api';
export type { FieldBindings, FieldKind, FormApi, FormProps } from './components/fyldo/Form';
export type { PageLink } from './components/fyldo/nav-model';
export type { GroupItemStatus } from './components/ui/group-item';

// The props of every `ui` component.
export type { PageHeaderProps } from './components/fyldo/PageHeader';
export type { SectionCardProps } from './components/fyldo/SectionCard';
export type { SettingRowProps } from './components/fyldo/SettingRow';
export type { TabsProps } from './components/fyldo/Tabs';
export type { BadgeProps } from './components/ui/badge';
export type { ButtonLinkProps, ButtonProps } from './components/ui/button';
export type { CheckboxProps } from './components/ui/checkbox';
export type { ChoiceCardsProps } from './components/ui/choice-card';
export type { CodeEditorProps } from './components/ui/code-editor';
export type { ColorPickerProps } from './components/ui/color-picker';
export type { DatePickerProps, TimePickerProps } from './components/ui/date-picker';
export type { DateRangePickerProps } from './components/ui/date-range-field';
export type { EmptyStateProps } from './components/ui/empty-state';
export type { GroupItemProps } from './components/ui/group-item';
export type { GroupListProps } from './components/ui/group-list';
export type { IconButtonProps } from './components/ui/icon-button';
export type { IconPickerProps } from './components/ui/icon-picker';
export type { InputProps } from './components/ui/input';
export type { AddItemCardProps, ItemCardProps } from './components/ui/item-card';
export type { MediaPickerProps } from './components/ui/media-field';
export type { ModalProps } from './components/ui/modal';
export type { MultiSelectProps } from './components/ui/multi-select';
export type { NoticeProps } from './components/ui/notice';
export type { NumberInputProps } from './components/ui/number-input';
export type { PaginationProps } from './components/ui/pagination';
export type { RadioGroupProps } from './components/ui/radio';
export type { SegmentedControlProps } from './components/ui/segmented-control';
export type { SelectProps } from './components/ui/select';
export type { StatCardProps } from './components/ui/stat-card';
export type { TagProps } from './components/ui/tag';
export type { TextareaProps } from './components/ui/textarea';
export type { ToggleProps } from './components/ui/toggle';
export type { TooltipProps } from './components/ui/tooltip';
export type { IconProps } from './icons/Icon';
