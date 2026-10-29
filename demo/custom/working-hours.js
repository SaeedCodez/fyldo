/**
 * A custom Fyldo field (docs/custom-fields.md): two selects, "Opens" and "Closes", saved as ONE value ("09:00-17:00")
 * and split again when the page shows it. Plain JavaScript with no build step: React and Fyldo's own components come
 * from the default export's argument, so the field looks like the others and never loads a second React.
 */
export default function workingHours({ React, ui }) {
  const h = React.createElement;

  /** "09:00-17:00" → ["09:00", "17:00"]; anything else → empty parts. */
  const split = (value) => {
    const parts = typeof value === 'string' ? value.split('-') : [];
    return [parts[0] || '', parts[1] || ''];
  };

  function WorkingHours({ value, onChange, onBlur, disabled, labelledBy, describedBy, props, locale }) {
    const [opens, closes] = split(value);

    // The labels follow the page's numerals (۰۹:۰۰ in Persian); the values stay ASCII.
    const options = React.useMemo(() => {
      const digits = new Intl.NumberFormat(locale.replace('_', '-'), { minimumIntegerDigits: 2, useGrouping: false });
      return props.times.map((time) => ({ value: time, label: time.split(':').map((part) => digits.format(Number(part))).join(':') }));
    }, [props.times, locale]);

    // Validate right after a pick, like Fyldo's own Select (its menu takes focus, so blur would come too early).
    const pick = (nextOpens, nextCloses) => {
      onChange(`${nextOpens}-${nextCloses}`);
      onBlur();
    };

    const select = (label, current, onValueChange) =>
      h(ui.Select, { size: 'md', options, value: current, placeholder: label, 'aria-label': label, disabled, onValueChange });

    // One field, two controls: a group named by the row's title, each select by its own label.
    return h(
      'div',
      { role: 'group', 'aria-labelledby': labelledBy, 'aria-describedby': describedBy, className: 'fyldo-demo-hours' },
      select(props.opens, opens, (next) => pick(next, closes)),
      h('span', { 'aria-hidden': true, className: 'fyldo-demo-hours-dash' }, '–'),
      select(props.closes, closes, (next) => pick(opens, next)),
    );
  }

  return {
    Component: WorkingHours,
    // Instant feedback only: the same check runs on the server (validate_cb in demo/demo.php), which decides.
    validate(value, { props }) {
      const [opens, closes] = split(value);
      if (opens === '' && closes === '') return null;
      if (opens === '' || closes === '') return props.incomplete;
      return closes > opens ? null : props.order;
    },
  };
}
