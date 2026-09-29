/**
 * Renders ONE component variant from the query string, for the Figma parity tests and for visual review.
 *   ?c=button&variant=primary&size=sm&state=default
 *   ?c=input&size=sm&state=error        ?c=toggle&size=md&checked=1&state=disabled       ?c=select&size=lg&state=filled
 *   ?c=textarea&state=error&label=…&placeholder=…&value=…&helper=…&error=…&count=172&limit=160&rows=4
 *   ?c=checkbox&checked=0|1|indeterminate&state=disabled&label=…      ?c=radio&checked=1&label=…
 *   ?c=checkbox-group / ?c=radio-group — the option cards of the "Checkbox & Radio · Usage" frame
 *       (?title=&description=&options=post:Posts|page:Pages|product:Products:Available in Pro.:disabled&value=post&parent=All)
 *       options are value:label:description:disabled:icon
 *   ?c=tag&size=sm|md&state=default|disabled&label=Posts&removable=0|1
 *   ?c=multi-select&size=sm&state=default|error|disabled&label=&placeholder=&helper=&error=&options=post:Posts|…&value=post,page&max=3&clear=1&search=0&footer=0
 * `dir=rtl` and `lang=fa` switch the direction like the real app does. Hover/focus are forced by the test (CDP).
 */
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Field } from '@base-ui/react/field';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, type ButtonSize, type ButtonVariant } from '../../../app/components/ui/button';
import { Checkbox, CheckboxGroup } from '../../../app/components/ui/checkbox';
import { FieldShell } from '../../../app/components/ui/field-shell';
import { GroupField } from '../../../app/components/ui/group-field';
import { RadioGroup } from '../../../app/components/ui/radio';
import { Textarea, TextareaFooter } from '../../../app/components/ui/textarea';
import { MultiSelectField } from '../../../app/components/ui/multi-select-field';
import { SelectField } from '../../../app/components/ui/select-field';
import { Tag, type TagSize } from '../../../app/components/ui/tag';
import { TextField } from '../../../app/components/ui/text-field';
import { Toggle } from '../../../app/components/ui/toggle';
import { setLocaleData } from '../../../app/i18n';
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
  ? { label: 'عنوان سایت', helper: 'در تب مرورگر و نتایج جستجو نمایش داده می‌شود.', placeholder: 'سایت وردپرسی من', value: 'فیلدو', error: 'این عنوان قبلاً استفاده شده است.', button: 'دکمه', role: 'نقش پیش‌فرض کاربر جدید', pick: 'یک نقش انتخاب کنید…', subscriber: 'مشترک' }
  : { label: 'Site title', helper: 'Shown in the browser tab and search results.', placeholder: 'My WordPress site', value: 'Fyldo', error: 'This title is already in use.', button: 'Button', role: 'New user default role', pick: 'Select a role…', subscriber: 'Subscriber' };

const roles = [
  { value: 'subscriber', label: text.subscriber },
  { value: 'editor', label: 'Editor' },
  { value: 'author', label: 'Author' },
  { value: 'admin', label: 'Administrator' },
];

const param = (name: string, fallback = ''): string => q.get(name) ?? fallback;

/** `options=post:Posts|page:Pages|product:Products:Available in Pro.:disabled` → option list. */
function optionsParam(): Array<{ value: string; label: string; description?: string; disabled?: boolean; icon?: string }> {
  return param('options')
    .split('|')
    .filter(Boolean)
    .map((raw) => {
      const [value = '', label = '', description = '', flag = '', icon = ''] = raw.split(':');
      return { value, label, ...(description ? { description } : {}), ...(flag === 'disabled' ? { disabled: true } : {}), ...(icon ? { icon } : {}) };
    });
}

function TextareaDemo() {
  const [value, setValue] = useState(param('value'));
  const count = q.get('count') === null ? [...value].length : Number(param('count'));
  const limit = q.get('limit') === null ? undefined : Number(param('limit'));
  const error = state === 'error' ? param('error') : undefined;
  return (
    <div style={{ width: 360 }}>
      <FieldShell label={param('label')} disabled={state === 'disabled'} error={error} footer={<TextareaFooter description={param('helper')} error={error} count={count} limit={limit} />}>
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
  return <CheckboxGroup options={optionsParam()} value={value} onValueChange={setValue} parent={param('parent') || undefined} />;
}

function RadioGroupDemo() {
  const [value, setValue] = useState(param('value'));
  return <RadioGroup options={optionsParam()} value={value} onValueChange={setValue} />;
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

function Variant() {
  switch (q.get('c')) {
    case 'textarea':
      return <TextareaDemo />;
    case 'tag':
      return <Tag label={param('label', 'Posts')} size={(q.get('size') === 'md' ? 'md' : 'sm') as TagSize} disabled={state === 'disabled'} onRemove={q.get('removable') === '0' ? undefined : () => undefined} />;
    case 'multi-select':
      return <MultiSelectDemo />;
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
            options={[{ value: 'a', label: param('label', 'Full width'), description: q.get('description') ?? undefined }]}
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
          <GroupField label={param('title')} description={param('description')} disabled={state === 'disabled'}>
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
      return <p>Pick a component: ?c=button|input|toggle|select|textarea|checkbox|radio|checkbox-group|radio-group|tag|multi-select</p>;
  }
}

(async () => {
  if (rtl) {
    const jed = await (await fetch('./fyldo-fa_IR.json')).json();
    setLocaleData(jed);
  }
  await preloadIcons(['global']);
  createRoot(stage).render(
    <PortalContainerContext.Provider value={root}>
      <DirectionProvider direction={rtl ? 'rtl' : 'ltr'}>
        <div data-variant-root style={{ display: 'inline-block', margin: 24 }}>
          <Variant />
        </div>
      </DirectionProvider>
    </PortalContainerContext.Provider>,
  );
  document.documentElement.dataset.ready = 'true';
})();
