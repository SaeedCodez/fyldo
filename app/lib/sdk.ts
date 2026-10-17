/**
 * What a developer's module (a custom field or a custom page) gets as the argument of its default export
 * (docs/custom-fields.md, docs/custom-pages.md). Version 1 never loses a member: they are only added. The components'
 * props are the ones in app/components, so they are public API too.
 */
import * as React from 'react';
import { Form } from '../components/fyldo/Form';
import { PageHeader } from '../components/fyldo/PageHeader';
import { SectionCard } from '../components/fyldo/SectionCard';
import { SettingRow } from '../components/fyldo/SettingRow';
import { Tabs } from '../components/fyldo/Tabs';
import { Badge } from '../components/ui/badge';
import { Button, ButtonLink } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { EmptyState } from '../components/ui/empty-state';
import { IconButton } from '../components/ui/icon-button';
import { Input } from '../components/ui/input';
import { AddItemCard, ItemCard } from '../components/ui/item-card';
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
    EmptyState,
    Icon,
    IconButton,
    Input,
    ItemCard,
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
    Toggle,
    Tooltip,
  },
  /** Fields of a form registered in PHP, stored by the plugin: `<Form form="…" record="new" | "<key>" onSaved={…} />`. */
  // Form → fields → custom-fields → modules → sdk is an import cycle: Form must stay a (hoisted) function declaration.
  Form,
} as const;

export type FyldoSdk = typeof sdk;
