// Builds the config PHP would inline, then loads the built bundle exactly like WordPress does (classic boot.js).
const params = new URLSearchParams(location.search);
const rtl = params.get('dir') === 'rtl';
const root = document.getElementById('fyldo-harness-root');

const page = await (await fetch('/tests/fixtures/slice-page.client.json')).json();
const i18n = rtl ? await (await fetch('/languages/fyldo-fa_IR.json')).json() : null;

document.documentElement.lang = rtl ? 'fa-IR' : 'en';
document.documentElement.dir = rtl ? 'rtl' : 'ltr';
root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
root.setAttribute('lang', rtl ? 'fa-IR' : 'en');

if (params.get('hostile')) {
  const link = document.getElementById('hostile');
  link.href = '/tests/harness/hostile.css';
  link.disabled = false;
}

window.__fyldo_harness__ = {
  slug: 'harness',
  title: 'Harness',
  version: '1.0.0',
  fyldoVersion: '1.0.0-dev',
  navigation: 'sidebar',
  groups: [],
  links: [],
  pages: [page],
  dir: rtl ? 'rtl' : 'ltr',
  locale: rtl ? 'fa-IR' : 'en',
  rootId: 'fyldo-harness-root',
  rest: { root: '/rest/', nonce: 'nonce', instanceNonce: 'inonce', nonceHeader: 'X-Fyldo-Nonce' },
  i18n,
};

const boot = document.createElement('script');
boot.src = '/assets/dist/boot.js';
document.body.append(boot);
