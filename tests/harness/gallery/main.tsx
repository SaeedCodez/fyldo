/**
 * Renders ONE component variant from the query string, for the Figma parity tests and for visual review.
 *   ?c=button&variant=primary&size=sm&state=default
 *   ?c=input&size=sm&state=error        ?c=toggle&size=md&checked=1&state=disabled       ?c=select&size=lg&state=filled
 *   ?c=textarea&state=error&label=…&placeholder=…&value=…&helper=…&error=…&count=172&limit=160&rows=4
 *   ?c=checkbox&checked=0|1|indeterminate&state=disabled&label=…      ?c=radio&checked=1&label=…
 *   ?c=checkbox-group / ?c=radio-group — the option cards of the "Checkbox & Radio · Usage" frame
 *       (?title=&description=&options=post:Posts|page:Pages|product:Products:Available in Pro.:disabled&value=post&parent=All)
 *       options are value:label:description:disabled:icon
 *   ?c=segmented-control&options=a:By order|b:By product|c:Simple&value=b   (hugs its content, as in the pack)
 *   ?c=choice-card&content=image_text|image|text&checked=0|1&state=default|disabled&label=…&description=…   (280 wide, the pack's placeholder art)
 *   ?c=choice-card-group&content=image_text|image|text&columns=2|3|4&state=default|error|disabled&label=…&helper=…&error=…&options=a:Light:Bright surfaces|b:Dark:Low-light ready&value=a   (576 wide)
 *   ?c=slider&size=sm|md&state=default|disabled&label=…&helper=…&value=75&suffix=%   (320 wide; the value is formatted in the page's numerals)
 *   ?c=color-picker&size=sm|md|lg&state=default|filled|error|disabled&label=…&placeholder=…&value=#2271b1&helper=…&error=…   (320 wide; empty = the dashed swatch)
 *   ?c=color-picker-panel&value=#2271b1   (the 280px panel on its own, EN or FA; presets = the 16 defaults)
 *   ?c=date-field&kind=date|datetime|time&size=sm|md|lg&state=default|error|disabled&calendar=auto|jalali|gregorian&label=…&placeholder=…&value=2026-10-20&helper=…&error=…
 *       (320 wide; preload names=calendar,arrow-down-2)
 *   ?c=date-range-field&kind=date|datetime|time&size=sm|md|lg&state=default|error|disabled&label=…&start_placeholder=…&end_placeholder=…&start=2026-10-20&end=2026-10-26&helper=…&error=…
 *       (480 wide; preload names=calendar,arrow-right)
 *   ?c=calendar-cell&kind=day|wide&state=default|hover|selected|today|outside|disabled&label=17
 *   ?c=calendar-panel&kind=date|datetime&calendar=gregorian|jalali&switch=1|0&value=2026-10-20   (the panel on its own; a datetime value is UTC)
 *   ?c=time-panel&type=popup|embedded&value=14:30&step=5
 *       the date and time sets pin the clock with today=2026-10-17 and the week start with start=0…6 (default 1, Monday)
 *   ?c=icon-picker&size=sm|md|lg&state=default|filled|error|disabled&label=…&placeholder=…&value=home-2&helper=…&error=…   (320 wide; empty = the dashed tile; preload its icons with names=)
 *   ?c=icon-picker-modal&value=star&icons=a,b,c&names=a,b,c   (the open modal on its own; icons = the names to offer, none = every Iconsax icon)
 *   ?c=upload-image|select-file&preview=empty|filled&state=default|error|disabled&label=…&helper=…&error=…&filename=…&filesize=38912&mime=…&ext=…&width=512&height=512&thumb=<url>&names=gallery-add,trash   (360 wide; the texts are Fyldo's own strings)
 *   ?c=tag&size=sm|md&state=default|disabled&label=Posts&removable=0|1
 *   ?c=notice&tone=gray|blue|green|amber|red&title=…&message=…      (the static Notice; 560 wide as in the pack)
 *   ?c=multi-select&size=sm&state=default|error|disabled&label=&placeholder=&helper=&error=&options=post:Posts|…&value=post,page&max=3&clear=1&search=0&footer=0
 *   ?c=badge&tone=gray&appearance=subtle&size=sm&label=Badge
 *   ?c=nav-item&state=default|hover|active|focus|disabled&label=General&icon=setting-2&badge=3   (224 wide, as in the pack)
 *   ?c=tab&state=default|active|disabled&label=General&icon=&count=
 *   ?c=tabs&tabs=Site identity|Reading|Permalinks|Privacy   (800 wide, the first tab active)
 *   ?c=sidebar&spec=<json>  /  ?c=top-navigation&spec=<json>   (spec: {brand, version, groups:[{label, items:[{label, icon, badge, active}]}], links:[{label, icon}]})
 *   ?c=page-header&title=…&description=…&action=Documentation   (800 wide; the action is an external link)
 *   ?c=section-card&tone=default|danger&spec=<json>   (spec: {title, description, rows:[{title, description, layout, value, checked}], footerText, action})
 *   ?c=save-bar&state=dirty|saving|saved|error   (800 wide, as in the pack; the texts are Fyldo's own strings)
 *   ?c=modal&title=…&description=…&cancel=…&confirm=…   (the Default modal, open)
 *   ?c=modal&type=danger&keyword=RESET&…   (the Danger modal with its typed confirmation; Confirm stays disabled)
 *   ?c=modal&…&content=<checkbox label>&content_description=…   (the Figma `Content` slot: a Checkbox with its description)
 *   ?c=item-card&spec=<json>&names=gallery   (304 wide; spec: {title, meta, description, media, status: {label, tone}, flag: {label, tone},
 *       tags: [..], details: [{icon, label}], actions: [{icon, label}]}; media = true draws the pack's placeholder icon box)
 *   ?c=item-card&type=add&title=…&description=…&names=add   (the Add card, 304 × 279 as in the pack)
 *   ?c=pagination&page=1&count=3&summary=…   (640 wide, as in the pack; the page text is Fyldo's own string)
 *   ?c=stat-card&label=…&value=…&icon=chart-21&trend=up|down|neutral&delta=12%&comparison=…   (222 wide, as in the pack)
 *   ?c=toast&tone=neutral|success|error|loading&title=…&description=…&action=…   (one toast, queued without a timeout)
 *   ?c=tooltip&placement=top|bottom|start|end&label=…   (an Icon Button whose tooltip is opened by keyboard focus)
 *   ?c=icon-button&variant=tertiary&size=sm&icon=more&label=…
 *   ?c=empty-state&size=lg|sm&icon=element-plus&title=…&description=…&primary=…&secondary=…   (560 / 360 wide, as in the pack)
 *   ?c=icons&names=a,b,c   a 20px grid of 16px icons (geometry matching of pack icons; not a component)
 *   ?c=group&title=…&description=…&items=<json>&sortable=1&addable=1&max=5&add=…&names=a,b   (894 wide, the Group field as a Setting
 *       Row draws it; items = [{label, icon, link}], each collapsed; the sub-fields are Label / Icon / Link)
 *   ?c=menu-message&kind=loading|empty|error   (the 310px status row of a Select Menu whose options load from the server)
 *   ?c=relation-select&multiple=0|1&label=…&placeholder=…&helper=…&items=3:Home|7:About us:Page&value=3   (320 wide; a post, term or
 *       user field searching `items` instead of a server; a hint after the second colon)
 * `dir=rtl` and `lang=fa` switch the direction like the real app does. Hover/focus are forced by the test (CDP).
 */
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Field } from '@base-ui/react/field';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FieldRenderer } from '../../../app/components/fyldo/FieldRenderer';
import { NavItem } from '../../../app/components/fyldo/NavItem';
import { PageHeader } from '../../../app/components/fyldo/PageHeader';
import { SaveBar, type SaveBarState } from '../../../app/components/fyldo/SaveBar';
import { SectionCard } from '../../../app/components/fyldo/SectionCard';
import { SettingRow } from '../../../app/components/fyldo/SettingRow';
import { Sidebar } from '../../../app/components/fyldo/Sidebar';
import { TAB_OUTER, TabLook } from '../../../app/components/fyldo/Tab';
import { Tabs } from '../../../app/components/fyldo/Tabs';
import { TopNavigation } from '../../../app/components/fyldo/TopNavigation';
import type { NavGroup } from '../../../app/components/fyldo/nav-model';
import { Badge, type BadgeSize, type BadgeTone } from '../../../app/components/ui/badge';
import { Input } from '../../../app/components/ui/input';
import { DragHandle } from '../../../app/icons/DragHandle';
import { Icon } from '../../../app/icons/Icon';
import { Button, type ButtonSize, type ButtonVariant } from '../../../app/components/ui/button';
import { Checkbox, CheckboxGroup } from '../../../app/components/ui/checkbox';
import { FieldShell } from '../../../app/components/ui/field-shell';
import { CodeEditor } from '../../../app/components/ui/code-editor';
import { GroupField } from '../../../app/components/ui/group-field';
import { GroupItem, type GroupItemStatus } from '../../../app/components/ui/group-item';
import { RadioGroup } from '../../../app/components/ui/radio';
import { ChoiceCard, type ChoiceCardContent } from '../../../app/components/ui/choice-card';
import { ChoiceCardGroup } from '../../../app/components/ui/choice-card-group';
import { SegmentedControl } from '../../../app/components/ui/segmented-control';
import { ColorPickerField } from '../../../app/components/ui/color-picker-field';
import { ColorPickerPanel } from '../../../app/components/ui/color-picker-panel';
import { CalendarCell, type CalendarCellKind } from '../../../app/components/ui/calendar-cell';
import { CalendarPanel } from '../../../app/components/ui/calendar-panel';
import { DateField, TimeField } from '../../../app/components/ui/date-field';
import { DateRangeField } from '../../../app/components/ui/date-range-field';
import { TimePanel } from '../../../app/components/ui/time-panel';
import { parseTime, setClock, setDateSettings, type CalendarKind } from '../../../app/lib/datetime';
import { IconPickerField } from '../../../app/components/ui/icon-picker-field';
import { MediaField } from '../../../app/components/ui/media-field';
import type { MediaKind } from '../../../app/lib/wp-media';
import type { CodeLanguage, FieldValue, GroupFieldDef, RelationItem } from '../../../app/types';
import IconPickerModal from '../../../app/components/ui/icon-picker-modal';
import { SliderField } from '../../../app/components/ui/slider-field';
import { Textarea, TextareaFooter } from '../../../app/components/ui/textarea';
import { MultiSelectField } from '../../../app/components/ui/multi-select-field';
import { MenuMessage, type MenuMessageKind } from '../../../app/components/ui/menu-message';
import { RelationSelect } from '../../../app/components/ui/relation-select';
import type { RelationSearch } from '../../../app/lib/relation';
import { EmptyState } from '../../../app/components/ui/empty-state';
import { IconButton } from '../../../app/components/ui/icon-button';
import { AddItemCard, ItemCard } from '../../../app/components/ui/item-card';
import { Modal } from '../../../app/components/ui/modal';
import { Pagination } from '../../../app/components/ui/pagination';
import { StatCard, type StatTrend } from '../../../app/components/ui/stat-card';
import { ToastProvider } from '../../../app/components/ui/toast';
import { TooltipProvider, type TooltipSide } from '../../../app/components/ui/tooltip';
import { createToaster, type ToastTone } from '../../../app/lib/toast';
import { Notice, type NoticeTone } from '../../../app/components/ui/notice';
import { SelectField } from '../../../app/components/ui/select-field';
import { Tag, type TagSize } from '../../../app/components/ui/tag';
import { TextField } from '../../../app/components/ui/text-field';
import { Toggle } from '../../../app/components/ui/toggle';
import { formatNumber, setLocaleData } from '../../../app/i18n';
import { preloadIcons } from '../../../app/icons/registry';
import { PortalContainerContext } from '../../../app/lib/portal';
import '../../../app/styles/app.css';

const q = new URLSearchParams(location.search);
const rtl = q.get('dir') === 'rtl';
const root = document.getElementById('fyldo-gallery-root') as HTMLElement;
const stage = document.getElementById('stage') as HTMLElement;

root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
root.setAttribute('lang', rtl ? 'fa-IR' : 'en');
document.documentElement.dir = rtl ? 'rtl' : 'ltr';

const state = q.get('state') ?? 'default';
const size = (q.get('size') ?? 'sm') as ButtonSize;
const text = rtl
  ? {
      label: 'عنوان سایت',
      helper: 'در تب مرورگر و نتایج جستجو نمایش داده می‌شود.',
      placeholder: 'سایت وردپرسی من',
      value: 'فیلدو',
      error: 'این عنوان قبلاً استفاده شده است.',
      button: 'دکمه',
      role: 'نقش پیش‌فرض کاربر جدید',
      pick: 'یک نقش انتخاب کنید…',
      subscriber: 'مشترک',
    }
  : {
      label: 'Site title',
      helper: 'Shown in the browser tab and search results.',
      placeholder: 'My WordPress site',
      value: 'Fyldo',
      error: 'This title is already in use.',
      button: 'Button',
      role: 'New user default role',
      pick: 'Select a role…',
      subscriber: 'Subscriber',
    };

const roles = [
  { value: 'subscriber', label: text.subscriber },
  { value: 'editor', label: 'Editor' },
  { value: 'author', label: 'Author' },
  { value: 'admin', label: 'Administrator' },
];

const param = (name: string, fallback = ''): string => q.get(name) ?? fallback;

/** `options=post:Posts|page:Pages|product:Products:Available in Pro.:disabled` → option list. */
function optionsParam(): Array<{
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  icon?: string;
}> {
  return param('options')
    .split('|')
    .filter(Boolean)
    .map((raw) => {
      const [value = '', label = '', description = '', flag = '', icon = ''] = raw.split(':');
      return {
        value,
        label,
        ...(description ? { description } : {}),
        ...(flag === 'disabled' ? { disabled: true } : {}),
        ...(icon ? { icon } : {}),
      };
    });
}

function TextareaDemo() {
  const [value, setValue] = useState(param('value'));
  const count = q.get('count') === null ? [...value].length : Number(param('count'));
  const limit = q.get('limit') === null ? undefined : Number(param('limit'));
  const error = state === 'error' ? param('error') : undefined;
  return (
    <div style={{ width: 360 }}>
      <FieldShell
        label={param('label')}
        disabled={state === 'disabled'}
        error={error}
        footer={
          <TextareaFooter description={param('helper')} error={error} count={count} limit={limit} />
        }
      >
        <Textarea
          value={value}
          onValueChange={setValue}
          placeholder={param('placeholder')}
          rows={Number(param('rows', '4'))}
          resize={param('resize', 'vertical') as 'vertical' | 'none'}
          disabled={state === 'disabled'}
        />
      </FieldShell>
    </div>
  );
}

function CheckboxGroupDemo() {
  const [value, setValue] = useState<string[]>(param('value').split(',').filter(Boolean));
  return (
    <CheckboxGroup
      options={optionsParam()}
      value={value}
      onValueChange={setValue}
      parent={param('parent') || undefined}
    />
  );
}

function RadioGroupDemo() {
  const [value, setValue] = useState(param('value'));
  return <RadioGroup options={optionsParam()} value={value} onValueChange={setValue} />;
}

function SegmentedDemo() {
  const [value, setValue] = useState(param('value'));
  return <SegmentedControl aria-label={param('label', 'View')} options={optionsParam()} value={value} onValueChange={setValue} disabled={state === 'disabled'} />;
}

/** The pack's placeholder art (sun, mountain, hill; `border/default`, `border/strong`, `border/hover`) as a picture, 16:10. Not an asset of the product. */
const CARD_ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 276 172.5" preserveAspectRatio="none">' +
      '<rect width="276" height="172.5" fill="#ebebeb"/><circle cx="204.05" cy="40.11" r="10.85" fill="#ffffff"/>' +
      '<polygon points="110,74.49 33.12,172.5 186.89,172.5" fill="#a8a8a8"/>' +
      '<polygon points="186.1,109.77 126.96,172.5 245.25,172.5" fill="#c9c9c9"/></svg>',
  );

function ChoiceCardDemo() {
  const content = param('content', 'image_text') as ChoiceCardContent;
  return (
    <div style={{ width: 280 }}>
      <BaseRadioGroup value={q.get('checked') === '1' ? 'a' : ''} onValueChange={() => undefined} disabled={state === 'disabled'}>
        <ChoiceCard
          option={{ value: 'a', label: param('label', 'Light'), description: param('description') || undefined, image: CARD_ART }}
          content={content}
          disabled={state === 'disabled'}
        />
      </BaseRadioGroup>
    </div>
  );
}

function ChoiceCardGroupDemo() {
  const [value, setValue] = useState(param('value'));
  const content = param('content', 'image_text') as ChoiceCardContent;
  const options = optionsParam().map((option) => ({ ...option, ...(content === 'text' ? {} : { image: CARD_ART }) }));
  return (
    <div style={{ width: 576 }}>
      <ChoiceCardGroup
        label={param('label')}
        description={param('helper') || undefined}
        error={state === 'error' ? param('error') : undefined}
        options={options}
        content={content}
        columns={Number(param('columns', '2')) as 2 | 3 | 4}
        value={value}
        onValueChange={setValue}
        disabled={state === 'disabled'}
      />
    </div>
  );
}

function SliderDemo() {
  const [value, setValue] = useState(Number(param('value', '75')));
  const suffix = param('suffix');
  return (
    <div style={{ width: 320 }}>
      <SliderField
        label={param('label')}
        description={param('helper') || undefined}
        size={size === 'md' ? 'md' : 'sm'}
        value={value}
        onValueChange={setValue}
        formatValue={(n) => formatNumber(n, rtl ? 'fa' : 'en') + suffix}
        disabled={state === 'disabled'}
      />
    </div>
  );
}

function ColorPickerDemo() {
  const [value, setValue] = useState(param('value'));
  return (
    <div style={{ width: 320 }}>
      <ColorPickerField
        label={param('label')}
        description={param('helper') || undefined}
        placeholder={param('placeholder') || undefined}
        size={size}
        value={value}
        onValueChange={setValue}
        locale={locale}
        error={state === 'error' ? param('error') : undefined}
        disabled={state === 'disabled'}
      />
    </div>
  );
}

function IconPickerDemo() {
  const [value, setValue] = useState(param('value'));
  return (
    <div style={{ width: 320 }}>
      <IconPickerField
        label={param('label')}
        description={param('helper') || undefined}
        placeholder={param('placeholder') || undefined}
        size={size}
        value={value}
        onValueChange={setValue}
        locale={locale}
        error={state === 'error' ? param('error') : undefined}
        disabled={state === 'disabled'}
      />
    </div>
  );
}

/** The Group field (Figma "Group" / "Group Item"): header buttons with a Label, an Icon and a Link, every item collapsed. */
function GroupDemo() {
  const [value, setValue] = useState<FieldValue>(() => JSON.parse(param('items', '[]')) as FieldValue);
  const sub = { description: '', disabled: false, layout: 'field', validate: {} } as const;
  const field: GroupFieldDef = {
    id: 'header_buttons',
    type: 'group',
    label: param('title'),
    description: param('description'),
    default: [],
    disabled: false,
    layout: 'stacked',
    validate: {},
    fields: [
      { ...sub, id: 'label', type: 'text', label: 'Label', default: '', placeholder: '' },
      { ...sub, id: 'icon', type: 'icon', label: 'Icon', default: '', icons: null },
      { ...sub, id: 'link', type: 'url', label: 'Link', default: '', placeholder: '' },
    ],
    item_title: 'label',
    item_icon: 'icon',
    sortable: q.get('sortable') === '1',
    addable: q.get('addable') === '1',
    min: null,
    max: q.get('max') === null ? null : Number(param('max')),
    add_label: param('add'),
  };
  return (
    <div style={{ width: 894 }}>
      <FieldRenderer field={field} value={value} divider onChange={(_, next) => setValue(next)} onBlur={() => undefined} locale={locale} />
    </div>
  );
}

/** Code Editor with its label and helper (Figma "Code Editor", 520 wide): `code`, `language`, `invalid` (lines, comma-separated). */
function CodeEditorDemo() {
  const [value, setValue] = useState(param('code'));
  const error = state === 'error' ? param('error') : undefined;
  return (
    <div style={{ width: 520 }}>
      <FieldShell label={param('label')} description={param('helper') || undefined} error={error} disabled={state === 'disabled'}>
        <CodeEditor
          value={value}
          onValueChange={setValue}
          language={param('language', 'css') as CodeLanguage}
          invalidLines={param('invalid').split(',').filter(Boolean).map(Number)}
          disabled={state === 'disabled'}
        />
      </FieldShell>
    </div>
  );
}

/** One Group Item on its own (Figma "Group Item"), collapsed, with `status` labels (JSON) and `inactive=1`. */
function GroupItemDemo() {
  const title = param('title');
  return (
    <div style={{ width: 894 }}>
      <GroupItem
        title={title}
        summary={param('summary') || undefined}
        mono
        preview={param('preview')}
        open={false}
        onOpenChange={() => undefined}
        status={JSON.parse(param('status', '[]')) as GroupItemStatus[]}
        inactive={q.get('inactive') === '1'}
        handle={
          <span data-slot="fy-group-item-handle" className="fy:flex fy:size-5 fy:items-center fy:justify-center fy:rounded-xs fy:text-icon-tertiary">
            <DragHandle size={20} />
          </span>
        }
        actions={
          <>
            <IconButton icon="copy" label={`Duplicate ${title}`} />
            <IconButton icon="trash" label={`Remove ${title}`} />
          </>
        }
      >
        {null}
      </GroupItem>
    </div>
  );
}

/** Upload Image / Select File, empty or filled (`preview=filled` + the attachment's facts). Hover and focus are forced by the test. */
function MediaDemo({ kind }: { kind: MediaKind }) {
  const filled = param('preview') === 'filled';
  const media = filled
    ? {
        id: 7,
        filename: param('filename'),
        filesize: Number(param('filesize', '0')),
        mime: param('mime'),
        extension: param('ext'),
        width: q.get('width') === null ? null : Number(param('width')),
        height: q.get('height') === null ? null : Number(param('height')),
        thumbnail: param('thumb') || null,
      }
    : null;
  return (
    <div style={{ width: 360 }}>
      <MediaField
        kind={kind}
        label={param('label')}
        description={param('helper') || undefined}
        value={filled ? 7 : 0}
        media={media}
        locale={locale}
        onValueChange={() => undefined}
        onError={() => undefined}
        error={state === 'error' ? param('error') : undefined}
        disabled={state === 'disabled'}
      />
    </div>
  );
}

function IconPickerModalDemo() {
  const icons = param('icons').split(',').filter(Boolean);
  // the modal portals into the root, centred in the viewport; the stage keeps a box so the test can find it
  return (
    <div style={{ width: 1, height: 1 }}>
      <IconPickerModal open anchorRef={{ current: null }} value={param('value')} icons={icons.length > 0 ? icons : null} locale={locale} onSelect={() => undefined} onClose={() => undefined} />
    </div>
  );
}

function ColorPickerPanelDemo() {
  const [value, setValue] = useState(param('value', '#2271b1'));
  return <ColorPickerPanel value={value} onValueChange={setValue} locale={locale} />;
}

function DateFieldDemo() {
  const [value, setValue] = useState(param('value'));
  const kind = param('kind', 'date');
  const common = {
    label: param('label'),
    description: param('helper') || undefined,
    placeholder: param('placeholder') || undefined,
    size,
    value,
    onValueChange: setValue,
    locale,
    error: state === 'error' ? param('error') : undefined,
    disabled: state === 'disabled',
  };
  return (
    <div style={{ width: 320 }}>
      {kind === 'time' ? (
        <TimeField {...common} step={Number(param('step', '1'))} />
      ) : (
        <DateField {...common} kind={kind === 'datetime' ? 'datetime' : 'date'} calendar={param('calendar', 'auto') as CalendarKind | 'auto'} />
      )}
    </div>
  );
}

function DateRangeFieldDemo() {
  const [value, setValue] = useState({ start: param('start'), end: param('end') });
  const kind = param('kind', 'date');
  return (
    <div style={{ width: 480 }}>
      <DateRangeField
        label={param('label')}
        description={param('helper') || undefined}
        kind={kind === 'time' || kind === 'datetime' ? kind : 'date'}
        startPlaceholder={param('start_placeholder') || undefined}
        endPlaceholder={param('end_placeholder') || undefined}
        size={size}
        value={value}
        onValueChange={setValue}
        calendar="gregorian"
        locale={locale}
        error={state === 'error' ? param('error') : undefined}
        disabled={state === 'disabled'}
      />
    </div>
  );
}

function CalendarCellDemo() {
  const look = param('state', 'default');
  return (
    <CalendarCell
      kind={param('kind', 'day') as CalendarCellKind}
      selected={look === 'selected'}
      today={look === 'today'}
      outside={look === 'outside'}
      disabled={look === 'disabled'}
      className={look === 'hover' ? 'fy:bg-brand-subtle fy:text-brand-text' : param('kind') === 'wide' ? 'fy:w-22' : undefined}
    >
      {param('label', rtl ? '۲۵' : '17')}
    </CalendarCell>
  );
}

function CalendarPanelDemo() {
  const [value, setValue] = useState(param('value', '2026-10-20'));
  return (
    <CalendarPanel
      kind={param('kind', 'date') === 'datetime' ? 'datetime' : 'date'}
      value={value}
      onValueChange={setValue}
      calendar={param('calendar', 'gregorian') as CalendarKind}
      switchable={param('switch', '1') !== '0'}
      step={Number(param('step', '5'))}
      locale={locale}
    />
  );
}

function TimePanelDemo() {
  const [value, setValue] = useState(parseTime(param('value', '14:30')));
  return (
    <TimePanel
      value={value}
      onValueChange={setValue}
      step={Number(param('step', '5'))}
      type={param('type', 'popup') === 'embedded' ? 'embedded' : 'popup'}
      locale={locale}
      onNow={() => undefined}
    />
  );
}

function MultiSelectDemo() {
  const [value, setValue] = useState<string[]>(param('value').split(',').filter(Boolean));
  const error = state === 'error' ? param('error') : undefined;
  return (
    <div style={{ width: 320 }}>
      <MultiSelectField
        label={param('label')}
        description={param('helper')}
        placeholder={param('placeholder')}
        size={size}
        options={optionsParam()}
        value={value}
        onValueChange={setValue}
        maxVisibleTags={q.get('max') === null ? undefined : Number(param('max'))}
        clearable={q.get('clear') === '1'}
        searchable={q.get('search') !== '0'}
        menuFooter={q.get('footer') !== '0'}
        error={error}
        disabled={state === 'disabled'}
      />
    </div>
  );
}

/** `items=3:Home|7:About us:Page` → relation items (value:label:hint). */
function relationItems(): RelationItem[] {
  return param('items')
    .split('|')
    .filter(Boolean)
    .map((entry) => {
      const [value = '0', label = '', hint = ''] = entry.split(':');
      return { value: Number(value), label, hint };
    });
}

function RelationSelectDemo() {
  const multiple = q.get('multiple') === '1';
  const [value, setValue] = useState<number | number[]>(() => {
    const ids = param('value').split(',').filter(Boolean).map(Number);
    return multiple ? ids : (ids[0] ?? 0);
  });
  // A "server" that knows `items`: every one before anything is typed, the matching ones after.
  const search = useMemo<RelationSearch>(() => {
    const items = relationItems();
    return async (_path, query) => ({
      items: query.include ? items.filter((i) => query.include!.includes(i.value)) : items.filter((i) => i.label.toLowerCase().includes((query.search ?? '').toLowerCase())),
      more: false,
    });
  }, []);
  return (
    <div style={{ width: 320 }}>
      <FieldShell label={param('label')} description={param('helper') || undefined}>
        <RelationSelect
          value={value}
          multiple={multiple}
          search={search}
          path="gallery"
          placeholder={param('placeholder')}
          size={size}
          aria-label={param('label')}
          onValueChange={(next) => setValue(next)}
        />
      </FieldShell>
    </div>
  );
}

interface NavSpec {
  brand: string;
  version?: string;
  groups: Array<{
    label?: string;
    items: Array<{ label: string; icon?: string; badge?: string; active?: boolean }>;
  }>;
  links?: Array<{ label: string; icon?: string }>;
}

const locale = rtl ? 'fa-IR' : 'en';

function navFromSpec(spec: NavSpec): {
  groups: NavGroup[];
  links: Array<{ label: string; href: string; icon?: string; external: boolean }>;
} {
  return {
    groups: spec.groups.map((g, gi) => ({
      id: `g${gi}`,
      label: g.label,
      items: g.items.map((item, ii) => ({
        id: `p${gi}-${ii}`,
        label: item.label,
        href: `#/p${gi}-${ii}`,
        icon: item.icon || undefined,
        badge: item.badge || undefined,
        active: Boolean(item.active),
      })),
    })),
    links: (spec.links ?? []).map((l, i) => ({
      label: l.label,
      href: `#/link-${i}`,
      icon: l.icon || undefined,
      external: false,
    })),
  };
}

interface CardSpec {
  title: string;
  description?: string;
  rows?: Array<{
    title: string;
    description?: string;
    layout: 'inline' | 'stacked' | 'field';
    value?: string;
    checked?: boolean;
  }>;
  footerText?: string;
  action?: string;
}

function SectionCardDemo({ spec, tone }: { spec: CardSpec; tone: 'default' | 'danger' }) {
  const rows = spec.rows ?? [];
  return (
    <div style={{ width: 960 }}>
      <SectionCard
        title={spec.title}
        description={spec.description}
        tone={tone}
        footerText={spec.footerText}
        footer={
          spec.action ? (
            <Button variant={tone === 'danger' ? 'error' : 'primary'} size="sm">
              {spec.action}
            </Button>
          ) : undefined
        }
      >
        {rows.length > 0
          ? rows.map((row, index) => (
              <SettingRow
                key={row.title}
                title={row.title}
                description={row.description}
                layout={row.layout}
                divider={index < rows.length - 1}
              >
                {row.layout === 'inline' ? (
                  <Toggle size="md" defaultChecked={Boolean(row.checked)} />
                ) : (
                  <Input size="md" defaultValue={row.value ?? ''} />
                )}
              </SettingRow>
            ))
          : undefined}
      </SectionCard>
    </div>
  );
}

interface ItemCardSpec {
  title: string;
  meta?: string;
  description?: string;
  media?: boolean;
  status?: { label: string; tone: BadgeTone };
  flag?: { label: string; tone: BadgeTone };
  tags?: string[];
  details?: Array<{ icon: string; label: string }>;
  actions?: Array<{ icon: string; label: string }>;
}

/** The Item Card from a spec; the media area holds the pack's placeholder (a 56px icon box with `gallery`), not product art. */
function ItemCardDemo() {
  if (q.get('type') === 'add') {
    return (
      <div style={{ width: 304, height: 279, display: 'flex' }}>
        <AddItemCard title={param('title')} description={param('description') || undefined} onClick={() => undefined} />
      </div>
    );
  }
  const spec = JSON.parse(param('spec', '{}')) as ItemCardSpec;
  const badge = (b?: { label: string; tone: BadgeTone }) => (b ? <Badge tone={b.tone}>{b.label}</Badge> : undefined);
  return (
    <div style={{ width: 304 }}>
      <ItemCard
        title={spec.title}
        meta={spec.meta}
        description={spec.description}
        media={
          spec.media ? (
            <span className="fy:flex fy:size-14 fy:items-center fy:justify-center fy:rounded-lg fy:border fy:border-border-default fy:bg-background-default fy:text-icon-tertiary">
              <Icon name="gallery" size={24} />
            </span>
          ) : undefined
        }
        status={badge(spec.status)}
        flag={badge(spec.flag)}
        tags={spec.tags}
        details={spec.details}
        actions={spec.actions?.map((a) => <IconButton key={a.label} icon={a.icon} label={a.label} />)}
        onOpen={() => undefined}
      />
    </div>
  );
}

function PaginationDemo() {
  const [page, setPage] = useState(Number(param('page', '1')));
  return (
    <div style={{ width: 640 }}>
      <Pagination page={page} pageCount={Number(param('count', '3'))} onPageChange={setPage} summary={param('summary') || undefined} />
    </div>
  );
}

/** One toast, queued without a timeout so it stays put for the screenshot (the stack is fixed at the bottom-end corner). */
function ToastDemo() {
  const [toaster] = useState(createToaster);
  useEffect(() => {
    // the provider subscribes to the manager in its own effect, which runs after this one: queue on the next tick
    const id = window.setTimeout(
      () =>
        toaster.show({
          tone: param('tone', 'neutral') as ToastTone,
          title: param('title'),
          description: param('description') || undefined,
          action: param('action') ? { label: param('action'), onClick: () => undefined } : undefined,
          timeout: 0,
        }),
      0,
    );
    return () => window.clearTimeout(id);
  }, [toaster]);
  return (
    // the stack is fixed to the viewport corner; the stage keeps a box so the test can find its coordinates
    <div style={{ width: 1, height: 1 }}>
      <ToastProvider toaster={toaster}>
        <span />
      </ToastProvider>
    </div>
  );
}

function Variant() {
  switch (q.get('c')) {
    case 'toast':
      return <ToastDemo />;
    case 'tooltip':
      // Tab to the button: keyboard focus opens the tooltip at once (design rule 10)
      return (
        <div style={{ padding: '48px 200px' }}>
          <IconButton
            icon={param('icon', 'copy')}
            label={param('label', 'Copy shortcode')}
            tooltipSide={param('placement', 'top') as TooltipSide}
          />
        </div>
      );
    case 'icon-button':
      return (
        <IconButton
          icon={param('icon', 'more')}
          label={param('label', 'More')}
          variant={(q.get('variant') ?? 'tertiary') as ButtonVariant}
          size={size}
          disabled={state === 'disabled'}
          loading={state === 'loading'}
        />
      );
    case 'empty-state': {
      const large = q.get('size') !== 'sm';
      return (
        <div style={{ width: large ? 560 : 360 }}>
          <EmptyState
            size={large ? 'lg' : 'sm'}
            icon={param('icon', 'element-plus')}
            title={param('title')}
            description={param('description') || undefined}
            primaryAction={param('primary') ? <Button>{param('primary')}</Button> : undefined}
            secondaryAction={
              param('secondary') ? <Button>{param('secondary')}</Button> : undefined
            }
          />
        </div>
      );
    }
    case 'icons':
      return (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(40, 20px)', gridAutoRows: '20px' }}
        >
          {param('names')
            .split(',')
            .filter(Boolean)
            .map((name) => (
              <span
                key={name}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name={name} size={16} />
              </span>
            ))}
        </div>
      );
    case 'badge':
      return (
        <Badge
          tone={param('tone', 'gray') as BadgeTone}
          appearance={param('appearance', 'subtle') as 'subtle' | 'solid'}
          size={param('size', 'sm') as BadgeSize}
        >
          {param('label', 'Badge')}
        </Badge>
      );
    case 'nav-item':
      return (
        <div style={{ width: 224 }}>
          <NavItem
            label={param('label', 'General')}
            href="#/general"
            icon={q.get('icon') ?? 'setting-2'}
            badge={param('badge') || undefined}
            active={state === 'active'}
            disabled={state === 'disabled'}
            locale={locale}
          />
        </div>
      );
    case 'tab':
      return (
        <button type="button" className={TAB_OUTER}>
          <TabLook
            label={param('label', 'General')}
            icon={param('icon') || undefined}
            badge={param('count') || undefined}
            active={state === 'active'}
            disabled={state === 'disabled'}
            locale={locale}
          />
        </button>
      );
    case 'tabs': {
      const labels = param('tabs').split('|').filter(Boolean);
      return (
        <div style={{ width: 960 }}>
          <Tabs
            aria-label="Tabs"
            value="t0"
            onValueChange={() => undefined}
            tabs={labels.map((label, i) => ({ id: `t${i}`, label }))}
            locale={locale}
          >
            {() => null}
          </Tabs>
        </div>
      );
    }
    case 'sidebar':
    case 'top-navigation': {
      const spec = JSON.parse(param('spec', '{}')) as NavSpec;
      const { groups, links } = navFromSpec(spec);
      const brand = { name: spec.brand, version: spec.version };
      return q.get('c') === 'sidebar' ? (
        <div style={{ height: 800 }}>
          <Sidebar brand={brand} groups={groups} links={links} locale={locale} />
        </div>
      ) : (
        <div style={{ width: Number(param('width', '1280')) }}>
          <TopNavigation brand={brand} groups={groups} links={links} locale={locale} />
        </div>
      );
    }
    case 'page-header':
      return (
        <div style={{ width: 960 }}>
          <PageHeader
            title={param('title')}
            description={param('description') || undefined}
            links={
              param('action') ? [{ label: param('action'), href: '#docs', external: true }] : []
            }
          />
        </div>
      );
    case 'save-bar':
      return (
        <div style={{ width: 960 }}>
          <SaveBar
            state={state as SaveBarState}
            onSave={() => undefined}
            onDiscard={() => undefined}
          />
        </div>
      );
    case 'modal':
      // the modal portals into the root, centred in the viewport; the stage keeps a box so the test can find it
      return (
        <div style={{ width: 1, height: 1 }}>
          <Modal
            open
            onOpenChange={() => undefined}
            title={param('title')}
            description={param('description') || undefined}
            cancelLabel={param('cancel')}
            confirmLabel={param('confirm')}
            onConfirm={() => undefined}
            tone={param('type', 'default') as 'default' | 'danger'}
            confirmKeyword={param('keyword') || undefined}
          >
            {param('content') ? <Checkbox label={param('content')} description={param('content_description') || undefined} /> : undefined}
          </Modal>
        </div>
      );
    case 'section-card':
      return (
        <SectionCardDemo
          spec={JSON.parse(param('spec', '{}')) as CardSpec}
          tone={param('tone', 'default') as 'default' | 'danger'}
        />
      );
    case 'item-card':
      return <ItemCardDemo />;
    case 'pagination':
      return <PaginationDemo />;
    case 'stat-card': {
      const trend = param('trend', 'up') as StatTrend;
      return (
        <div style={{ width: 222 }}>
          <StatCard
            label={param('label')}
            value={param('value')}
            icon={param('icon') || undefined}
            delta={param('delta') ? { value: param('delta'), trend } : undefined}
            comparison={param('comparison') || undefined}
          />
        </div>
      );
    }
    case 'textarea':
      return <TextareaDemo />;
    case 'tag':
      return (
        <Tag
          label={param('label', 'Posts')}
          size={(q.get('size') === 'md' ? 'md' : 'sm') as TagSize}
          disabled={state === 'disabled'}
          onRemove={q.get('removable') === '0' ? undefined : () => undefined}
        />
      );
    case 'menu-message':
      return (
        <div style={{ width: 310 }}>
          <MenuMessage kind={(q.get('kind') ?? 'loading') as MenuMessageKind} />
        </div>
      );
    case 'relation-select':
      return <RelationSelectDemo />;
    case 'multi-select':
      return <MultiSelectDemo />;
    case 'segmented-control':
      return <SegmentedDemo />;
    case 'choice-card':
      return <ChoiceCardDemo />;
    case 'choice-card-group':
      return <ChoiceCardGroupDemo />;
    case 'slider':
      return <SliderDemo />;
    case 'color-picker':
      return <ColorPickerDemo />;
    case 'color-picker-panel':
      return <ColorPickerPanelDemo />;
    case 'date-field':
      return <DateFieldDemo />;
    case 'date-range-field':
      return <DateRangeFieldDemo />;
    case 'calendar-cell':
      return <CalendarCellDemo />;
    case 'calendar-panel':
      return <CalendarPanelDemo />;
    case 'time-panel':
      return <TimePanelDemo />;
    case 'icon-picker':
      return <IconPickerDemo />;
    case 'icon-picker-modal':
      return <IconPickerModalDemo />;
    case 'group':
      return <GroupDemo />;
    case 'group-item':
      return <GroupItemDemo />;
    case 'code-editor':
      return <CodeEditorDemo />;
    case 'upload-image':
      return <MediaDemo kind="image" />;
    case 'select-file':
      return <MediaDemo kind="file" />;
    case 'notice':
      return (
        <div style={{ width: 560 }}>
          <Notice tone={param('tone', 'gray') as NoticeTone} title={param('title') || undefined}>
            {param('message')}
          </Notice>
        </div>
      );
    case 'checkbox':
      return (
        <Checkbox
          label={param('label', 'Send email notifications')}
          description={q.get('description') ?? undefined}
          defaultChecked={q.get('checked') === '1'}
          indeterminate={q.get('checked') === 'indeterminate'}
          disabled={state === 'disabled'}
        />
      );
    case 'radio':
      return (
        <Field.Root disabled={state === 'disabled'}>
          <RadioGroup
            aria-label={param('label', 'Full width')}
            options={[
              {
                value: 'a',
                label: param('label', 'Full width'),
                description: q.get('description') ?? undefined,
              },
            ]}
            value={q.get('checked') === '1' ? 'a' : ''}
            onValueChange={() => undefined}
            disabled={state === 'disabled'}
          />
        </Field.Root>
      );
    case 'checkbox-group':
    case 'radio-group':
      return (
        <div style={{ width: 354 }}>
          <GroupField
            label={param('title')}
            description={param('description')}
            disabled={state === 'disabled'}
          >
            {q.get('c') === 'radio-group' ? <RadioGroupDemo /> : <CheckboxGroupDemo />}
          </GroupField>
        </div>
      );
    case 'button':
      return (
        <Button
          variant={(q.get('variant') ?? 'primary') as ButtonVariant}
          size={size}
          disabled={state === 'disabled'}
          loading={state === 'loading'}
          leadingIcon={q.get('leading') ?? undefined}
          trailingIcon={q.get('trailing') ?? undefined}
        >
          {text.button}
        </Button>
      );
    case 'input':
      return (
        <div style={{ width: 320 }}>
          <TextField
            label={text.label}
            description={text.helper}
            placeholder={text.placeholder}
            size={size}
            defaultValue={state === 'filled' || state === 'error' ? text.value : ''}
            error={state === 'error' ? text.error : undefined}
            disabled={state === 'disabled'}
          />
        </div>
      );
    case 'toggle':
      return (
        <Toggle
          size={size === 'md' ? 'md' : 'sm'}
          defaultChecked={q.get('checked') === '1'}
          disabled={state === 'disabled'}
          label={rtl ? 'فعال‌سازی کش' : 'Enable caching'}
        />
      );
    case 'select':
      return (
        <div style={{ width: 320 }}>
          <SelectField
            label={text.role}
            description={text.helper}
            placeholder={text.pick}
            size={size}
            options={roles}
            value={state === 'filled' || state === 'error' ? 'subscriber' : ''}
            onValueChange={() => undefined}
            error={state === 'error' ? text.error : undefined}
            disabled={state === 'disabled'}
          />
        </div>
      );
    default:
      return (
        <p>
          Pick a component:
          ?c=button|input|toggle|select|textarea|checkbox|radio|checkbox-group|radio-group|segmented-control|choice-card|choice-card-group|slider|color-picker|color-picker-panel|tag|multi-select|notice|badge|nav-item|tab|tabs|sidebar|top-navigation|page-header|section-card
        </p>
      );
  }
}

// The date and time sets: a fixed "today" (the pack shows 17 October 2026) and the site's week start.
if (q.get('today')) setClock(() => new Date(`${param('today')}T12:00:00Z`));
setDateSettings({ timezone: 'UTC', startOfWeek: Number(param('start', '1')), calendar: rtl ? 'jalali' : 'gregorian', locale });

(async () => {
  if (rtl) {
    const jed = await (await fetch('./fyldo-fa_IR.json')).json();
    setLocaleData(jed);
  }
  await preloadIcons(
    [
      'global',
      ...param('names').split(',').filter(Boolean),
      ...(param('spec').match(/"icon":"[^"]+"/g) ?? []).map((m) => m.slice(8, -1)),
      param('icon'),
    ].filter(Boolean),
  );
  createRoot(stage).render(
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={rtl ? 'rtl' : 'ltr'}>
        <TooltipProvider>
          <div data-variant-root style={{ display: 'inline-block', margin: 24 }}>
            <Variant />
          </div>
        </TooltipProvider>
      </DirectionProvider>
    </PortalContainerContext.Provider>,
  );
  document.documentElement.dataset.ready = 'true';
})();
