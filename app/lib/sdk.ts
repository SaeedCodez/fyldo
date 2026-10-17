/**
 * What a developer's module (a custom field or a custom page) gets as the argument of its default export
 * (docs/custom-fields.md, docs/custom-pages.md). Version 1 never loses a member: they are only added. The components'
 * props are the ones in app/components, so they are public API too, except the internal ones the types below leave out.
 */
import * as React from 'react';
import type { ComponentType } from 'react';
import { Form, useRecordForm } from '../components/fyldo/Form';
import { PageHeader } from '../components/fyldo/PageHeader';
import { SectionCard } from '../components/fyldo/SectionCard';
import { SettingRow } from '../components/fyldo/SettingRow';
import { Tabs } from '../components/fyldo/Tabs';
import { Badge } from '../components/ui/badge';
import { Button, ButtonLink } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { ColorPicker } from '../components/ui/color-picker';
import { DatePicker, TimePicker, type DatePickerProps, type TimePickerProps } from '../components/ui/date-picker';
import { DateRangePicker } from '../components/ui/date-range-field';
import { EmptyState } from '../components/ui/empty-state';
import { IconButton } from '../components/ui/icon-button';
import { GroupItem, type GroupItemProps } from '../components/ui/group-item';
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

/*
 * Props Fyldo uses inside and does not promise: a range's own ends (`bare`, `openOn`), and the dragging a Group owns
 * (`dragging`, `handle`, `style`). The components are the same; only their public types are narrower.
 */
const PublicDatePicker = DatePicker as ComponentType<Omit<DatePickerProps, 'bare' | 'openOn'>>;
const PublicTimePicker = TimePicker as ComponentType<Omit<TimePickerProps, 'bare'>>;
const PublicGroupItem = GroupItem as ComponentType<Omit<GroupItemProps, 'dragging' | 'handle' | 'style'>>;

export const sdk = {
  version: 1,
  /** Fyldo's own React 19: never bundle a second one (hooks break). */
  React,
  ui: {
    AddItemCard,
    Badge,
    Button,
    ButtonLink,
    Checkbox,
    ColorPicker,
    DatePicker: PublicDatePicker,
    DateRangePicker,
    EmptyState,
    GroupItem: PublicGroupItem,
    Icon,
    IconButton,
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
    SettingRow,
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
} as const;

export type FyldoSdk = typeof sdk;
