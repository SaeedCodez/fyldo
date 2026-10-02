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
 *   ?c=icon-picker&size=sm|md|lg&state=default|filled|error|disabled&label=…&placeholder=…&value=home-2&helper=…&error=…   (320 wide; empty = the dashed tile; preload its icons with names=)
 *   ?c=icon-picker-modal&value=star&icons=a,b,c&names=a,b,c   (the open modal on its own; icons = the names to offer, none = every Iconsax icon)
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
 *   ?c=toast&tone=neutral|success|error|loading&title=…&description=…&action=…   (one toast, queued without a timeout)
 *   ?c=tooltip&placement=top|bottom|start|end&label=…   (an Icon Button whose tooltip is opened by keyboard focus)
 *   ?c=icon-button&variant=tertiary&size=sm&icon=more&label=…
 *   ?c=empty-state&size=lg|sm&icon=element-plus&title=…&description=…&primary=…&secondary=…   (480 / 360 wide, as in the pack)
 *   ?c=icons&names=a,b,c   a 20px grid of 16px icons (geometry matching of pack icons; not a component)
 * `dir=rtl` and `lang=fa` switch the direction like the real app does. Hover/focus are forced by the test (CDP).
 */
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Field } from '@base-ui/react/field';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
import { Icon } from '../../../app/icons/Icon';
import { Button, type ButtonSize, type ButtonVariant } from '../../../app/components/ui/button';
import { Checkbox, CheckboxGroup } from '../../../app/components/ui/checkbox';
import { FieldShell } from '../../../app/components/ui/field-shell';
import { GroupField } from '../../../app/components/ui/group-field';
import { RadioGroup } from '../../../app/components/ui/radio';
import { ChoiceCard, type ChoiceCardContent } from '../../../app/components/ui/choice-card';
import { ChoiceCardGroup } from '../../../app/components/ui/choice-card-group';
import { SegmentedControl } from '../../../app/components/ui/segmented-control';
import { ColorPickerField } from '../../../app/components/ui/color-picker-field';
import { ColorPickerPanel } from '../../../app/components/ui/color-picker-panel';
import { IconPickerField } from '../../../app/components/ui/icon-picker-field';
import IconPickerModal from '../../../app/components/ui/icon-picker-modal';
import { SliderField } from '../../../app/components/ui/slider-field';
import { Textarea, TextareaFooter } from '../../../app/components/ui/textarea';
import { MultiSelectField } from '../../../app/components/ui/multi-select-field';
import { EmptyState } from '../../../app/components/ui/empty-state';
import { IconButton } from '../../../app/components/ui/icon-button';
import { Modal } from '../../../app/components/ui/modal';
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
    <div style={{ width: 800 }}>
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
        <div style={{ width: large ? 480 : 360 }}>
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
        <div style={{ width: 800 }}>
          <Tabs
            label="Tabs"
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
        <div style={{ width: 800 }}>
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
        <div style={{ width: 800 }}>
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
            type={param('type', 'default') as 'default' | 'danger'}
            confirmKeyword={param('keyword') || undefined}
          />
        </div>
      );
    case 'section-card':
      return (
        <SectionCardDemo
          spec={JSON.parse(param('spec', '{}')) as CardSpec}
          tone={param('tone', 'default') as 'default' | 'danger'}
        />
      );
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
    case 'icon-picker':
      return <IconPickerDemo />;
    case 'icon-picker-modal':
      return <IconPickerModalDemo />;
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
