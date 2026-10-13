// Builds the config PHP would inline, then loads the built bundle exactly like WordPress does (classic boot.js).
// Query flags: ?dir=rtl  ?hostile=1  ?nav=top (the Top Navigation layout; default: the Sidebar)
const params = new URLSearchParams(location.search);
const rtl = params.get('dir') === 'rtl';
const root = document.getElementById('fyldo-harness-root');

const load = async (name) => (await fetch(`/tests/fixtures/${name}.client.json`)).json();
const [general, fields, advanced] = await Promise.all([load('slice-page'), load('form-fields-page'), load('tabs-page')]);
// The custom field's module lives in the plugin folder on WordPress; here it is served from the repository. Its
// stylesheet is enqueued by PHP there; here it is linked by hand.
for (const section of fields.sections) for (const field of section.fields) if (field.type === 'custom') field.module = '/demo/custom/working-hours.js';
document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/demo/custom/working-hours.css' }));
const i18n = rtl ? await (await fetch('/languages/fyldo-fa_IR.json')).json() : null;

document.documentElement.lang = rtl ? 'fa-IR' : 'en';
document.documentElement.dir = rtl ? 'rtl' : 'ltr';
root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
root.setAttribute('lang', rtl ? 'fa-IR' : 'en');

if (params.get('hostile')) {
  const link = document.getElementById('hostile');
  link.href = '/e2e/mu-plugins/hostile.css';
  link.disabled = false;
}

window.__fyldo_harness__ = {
  slug: 'harness',
  title: rtl ? 'فیلدو' : 'Fyldo',
  logo: null,
  version: '1.0.0',
  fyldoVersion: '1.0.0-beta.4',
  navigation: params.get('nav') === 'top' ? 'top' : 'sidebar',
  groups: [
    { id: 'settings', label: rtl ? 'تنظیمات' : 'Settings' },
    { id: 'tools', label: rtl ? 'ابزارها' : 'Tools' },
  ],
  links: [
    { label: 'Documentation', url: 'https://example.com/docs', icon: 'book-1', external: true, placement: 'footer' },
    { label: 'Help & support', url: 'https://example.com/help', icon: 'message-question', external: true, placement: 'footer' },
  ],
  notices: [],
  pages: [
    { ...general, group: 'settings' },
    { ...fields, group: 'settings', badge: '3' },
    advanced,
  ],
  dir: rtl ? 'rtl' : 'ltr',
  locale: rtl ? 'fa-IR' : 'en',
  rootId: 'fyldo-harness-root',
  rest: { root: '/rest/', nonce: 'nonce', instanceNonce: 'inonce', nonceHeader: 'X-Fyldo-Nonce', refresh: '/wp-admin/admin-ajax.php?action=fyldo_acme_nonces' },
  i18n,
};

const boot = document.createElement('script');
boot.src = '/assets/dist/boot.js';
document.body.append(boot);
