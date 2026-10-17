/**
 * A custom Fyldo field that only shows (docs/custom-fields.md, `watch`): how the opening hours read on the site, drawn
 * from the page's other fields as the person edits them. It names them in PHP (`'watch' => [ 'working_hours',
 * 'special_days' ]`) and gets their current values as `values`. Its own value stays null: there is nothing to save.
 */
export default function hoursPreview({ React }) {
  const h = React.createElement;

  function HoursPreview({ values, props, locale, labelledBy, describedBy }) {
    // "09:00-17:00" → "09:00 – 17:00" in the page's numerals (۰۹:۰۰ in Persian); anything incomplete → "Not set".
    const digits = React.useMemo(() => new Intl.NumberFormat(locale.replace('_', '-'), { minimumIntegerDigits: 2, useGrouping: false }), [locale]);
    const time = (text) => text.split(':').map((part) => digits.format(Number(part))).join(':');
    const range = (value) => {
      const [opens, closes] = typeof value === 'string' ? value.split('-') : [];
      return opens && closes ? `${time(opens)} – ${time(closes)}` : props.none;
    };
    const days = Array.isArray(values.special_days) ? values.special_days.filter((item) => item && item.day) : [];

    const row = (label, hours, key) =>
      h('div', { key, className: 'fyldo-demo-sign-row' }, h('dt', null, label), h('dd', null, h('bdi', { dir: 'ltr' }, hours)));

    return h(
      'div',
      { role: 'group', 'aria-labelledby': labelledBy, 'aria-describedby': describedBy, className: 'fyldo-demo-sign' },
      h('p', { className: 'fyldo-demo-sign-title' }, props.title),
      h('dl', null, row(props.regular, range(values.working_hours), 'regular'), ...days.map((item, i) => row(item.day, range(item.hours), i))),
    );
  }

  return { Component: HoursPreview };
}
