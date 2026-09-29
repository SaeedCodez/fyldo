/**
 * Renders ONE component variant from the query string, for the Figma parity tests and for visual review.
 *   ?c=button&variant=primary&size=sm&state=default
 *   ?c=input&size=sm&state=error        ?c=toggle&size=md&checked=1&state=disabled       ?c=select&size=lg&state=filled
 * `dir=rtl` and `lang=fa` switch the direction like the real app does. Hover/focus are forced by the test (CDP).
 */
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { createRoot } from 'react-dom/client';
import { Button, type ButtonSize, type ButtonVariant } from '../../../app/components/ui/button';
import { SelectField } from '../../../app/components/ui/select-field';
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

function Variant() {
  switch (q.get('c')) {
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
      return <p>Pick a component: ?c=button|input|toggle|select</p>;
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
