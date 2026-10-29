/**
 * What a developer's module (a custom field or a custom page) gets as the argument of its default export
 * (docs/custom-fields.md, docs/custom-pages.md). Version 1 never loses a member: they are only added (`@since` in their
 * doc comment), so a module feature-detects with `'name' in sdk`. The components' props are public API too: each one's
 * props interface is Fyldo's own (app/sdk-types.ts), and Fyldo's internal props stay out of it.
 */
import * as React from 'react';
import type { ComponentType } from 'react';
import { Form, useRecordForm } from '../components/fyldo/Form';
import { PageHeader } from '../components/fyldo/PageHeader';
import { SectionCard } from '../components/fyldo/SectionCard';
import { SettingRow, type SettingRowProps } from '../components/fyldo/SettingRow';
import { Tabs } from '../components/fyldo/Tabs';
import { Badge } from '../components/ui/badge';
import { Button, ButtonLink } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { ChoiceCards } from '../components/ui/choice-card';
import { CodeEditor } from '../components/ui/code-editor';
import { ColorPicker } from '../components/ui/color-picker';
import { DatePicker, TimePicker, type DatePickerProps, type TimePickerProps } from '../components/ui/date-picker';
import { DateRangePicker } from '../components/ui/date-range-field';
import { EmptyState } from '../components/ui/empty-state';
import { IconButton } from '../components/ui/icon-button';
import { IconPicker } from '../components/ui/icon-picker';
import { GroupItem, type GroupItemProps } from '../components/ui/group-item';
import { GroupList } from '../components/ui/group-list';
import { Input } from '../components/ui/input';
import { AddItemCard, ItemCard } from '../components/ui/item-card';
import { MediaPicker } from '../components/ui/media-field';
import { Modal } from '../components/ui/modal';
import { MultiSelect } from '../components/ui/multi-select';
import { Notice } from '../components/ui/notice';
import { NumberInput } from '../components/ui/number-input';
import { Pagination } from '../components/ui/pagination';
import { RadioGroup } from '../components/ui/radio';
import { SegmentedControl } from '../components/ui/segmented-control';
import { Select } from '../components/ui/select';
import { StatCard } from '../components/ui/stat-card';
import { Tag } from '../components/ui/tag';
import { Textarea } from '../components/ui/textarea';
import { Toggle } from '../components/ui/toggle';
import { Tooltip } from '../components/ui/tooltip';
import { Icon } from '../icons/Icon';
import { iconSvg } from '../icons/svg';

/*
 * Props Fyldo uses inside and does not promise: a range's own ends (`bare`, `openOn`), the dragging a Group owns
 * (`dragging`, `handle`, `style`), and what Fyldo's fields tell their Setting Row (`variant`, `ownError`…). The
 * components are the same; only their public types are narrower.
 */
const PublicDatePicker = DatePicker as ComponentType<DatePickerProps>;
const PublicTimePicker = TimePicker as ComponentType<TimePickerProps>;
const PublicGroupItem = GroupItem as ComponentType<GroupItemProps>;
const PublicSettingRow = SettingRow as ComponentType<SettingRowProps>;

let fyldoVersion = '';

/** The version of the Fyldo that serves the screen, from the client config (app/main.tsx, before any module loads). */
export const setFyldoVersion = (version: string): void => {
  fyldoVersion = version;
};

export const sdk = {
  version: 1,
  /** The version of the Fyldo that serves the screen (`1.2.0`). Within 1.x, feature-detect a member with `'name' in sdk`. */
  get fyldoVersion(): string {
    return fyldoVersion;
  },
  /** Fyldo's own React 19: never bundle a second one (hooks break). */
  React,
  ui: {
    AddItemCard,
    Badge,
    Button,
    ButtonLink,
    Checkbox,
    ChoiceCards,
    CodeEditor,
    ColorPicker,
    DatePicker: PublicDatePicker,
    DateRangePicker,
    EmptyState,
    GroupItem: PublicGroupItem,
    GroupList,
    Icon,
    IconButton,
    IconPicker,
    Input,
    ItemCard,
    MediaPicker,
    Modal,
    MultiSelect,
    Notice,
    NumberInput,
    PageHeader,
    Pagination,
    RadioGroup,
    SectionCard,
    SegmentedControl,
    Select,
    SettingRow: PublicSettingRow,
    StatCard,
    Tabs,
    Tag,
    Textarea,
    TimePicker: PublicTimePicker,
    Toggle,
    Tooltip,
  },
  /** Fields of a form registered in PHP, stored by the plugin: `<Form form="…" record="new" | "<key>" onSaved={…} />`. */
  // Form → fields → custom-fields → modules → sdk is an import cycle: Form must stay a (hoisted) function declaration.
  Form,
  /** The same form, drawn by the page: `const form = useForm({ form, record, onSaved })`, then `h(form.Frame, null, …)`. */
  useForm: useRecordForm,
  /**
   * One Iconsax icon as `<svg>` markup, for drawing outside React (a shadow root, an iframe, a site preview): resolves to
   * the same markup as PHP's `Fyldo::icon()`, or '' for a name that is not an icon. Loads only that icon, once.
   */
  iconSvg,
} as const;

export type FyldoSdk = typeof sdk;
