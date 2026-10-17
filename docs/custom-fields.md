# Custom fields

Use a custom field when no built-in type fits, for example two selects that are saved as one value. You write the control
in JavaScript, with React or plain DOM. Fyldo does the rest the same way as for its own fields: the row (title,
description, disabled reason, error), the Save Bar, sanitizing, validation (in the browser and on the server), REST and
storage. It also works inside a `group`.

A working example ships with the demo: `demo/custom/working-hours.js` (+ `.css`), used on the demo's "Opening hours"
page (`demo/demo.php`, method `hours()`).

## PHP

```php
array(
	'id'          => 'working_hours',
	'type'        => 'custom',
	'label'       => __( 'Working hours', 'acme' ),
	'description' => __( 'When you open and close on a normal day.', 'acme' ),
	'module'      => plugins_url( 'fields/working-hours.js', __FILE__ ),
	'style'       => plugins_url( 'fields/working-hours.css', __FILE__ ), // optional
	'props'       => array(                                              // optional, passed to the module as-is
		'times'  => array( '08:00', '09:00', '17:00', '18:00' ),
		'opens'  => __( 'Opens', 'acme' ),
		'closes' => __( 'Closes', 'acme' ),
	),
	'default'     => '09:00-17:00',
	'validate'    => array( 'required' => true ),
	'validate_cb' => 'acme_check_hours', // the check that counts: the browser cannot be trusted
)
```

| Key | |
|---|---|
| `module` | **Required.** URL of an ES module, either `http(s)://…` or a path starting with `/`. Fyldo `import()`s it before the page first renders, so nothing pops in. |
| `style` | URL of a stylesheet. It is enqueued on the settings screen, after Fyldo's own CSS, once per URL. |
| `props` | An array keyed by name. It may hold only text, numbers, booleans, null and arrays, and it reaches the module unchanged. Put translated labels here, because the module has no text domain. |
| `default` | Any JSON value. Without one the value is `null`. |
| `media` | `true` when the module uses `ui.MediaPicker`: the screen then loads the WordPress media library. |

Every common key works as usual: `layout` (default `field`), `disabled`, `validate`, `validate_cb`, `sanitize_cb`,
`default_before`, `icon`, `badge`.

**The value** is any JSON value: text, a number, a boolean, null, or a list or array of these (nested at most 8 levels).
Fyldo cleans it the same way at every level: tags are stripped and line breaks kept (`sanitize_textarea_field`) in every
string and in every key. Anything else becomes `null`. Your `sanitize_cb` then receives that cleaned value. Your
`validate_cb` receives the sanitized value and returns `true`, `false` or a message; a message is shown under the field.

## JavaScript

The module's default export is a **function**. Fyldo calls it with an API object, and the function returns the field's
definition.

```js
export default function workingHours({ React, ui }) {
  const h = React.createElement;

  function WorkingHours({ value, onChange, onBlur, disabled, labelledBy, describedBy, props }) {
    const [opens = '', closes = ''] = typeof value === 'string' ? value.split('-') : [];
    const options = props.times.map((time) => ({ value: time, label: time }));
    const pick = (a, b) => { onChange(`${a}-${b}`); onBlur(); };

    return h('div', { role: 'group', 'aria-labelledby': labelledBy, 'aria-describedby': describedBy },
      h(ui.Select, { size: 'md', options, value: opens, 'aria-label': props.opens, disabled, onValueChange: (v) => pick(v, closes) }),
      h(ui.Select, { size: 'md', options, value: closes, 'aria-label': props.closes, disabled, onValueChange: (v) => pick(opens, v) }),
    );
  }

  return {
    Component: WorkingHours,
    validate: (value) => (/* a message, or null when valid */ null),
  };
}
```

### The API (first argument)

| | |
|---|---|
| `version` | `1`. Within v1, members are only ever added, never removed. Custom pages get the same object, with `Form` too. |
| `React` | Fyldo's own React 19. Use it for hooks and `createElement`. **Do not bundle React yourself**: a second copy breaks hooks. |
| `ui` | Fyldo's components, so your field matches the others: `Button`, `Checkbox`, `Icon`, `Input`, `NumberInput`, `Select`, `Textarea`, `Toggle`, and since custom pages every other public one (`Badge`, `MultiSelect`, `RadioGroup`, `SegmentedControl`, `Tag`, `Tooltip`, and the field controls `ColorPicker`, `DatePicker`, `TimePicker`, `DateRangePicker`, `MediaPicker`, `GroupItem`… — the full list and the controls' props are in [custom-pages.md](custom-pages.md#field-controls)). Their props are the same as in `app/components/ui/*` and stay stable within v1. Pass `size: 'md'` to match the controls of a Setting Row. |

### The definition (return value)

| | |
|---|---|
| `Component` | A React component, rendered with Fyldo's React. |
| `mount(element, props)` | Plain DOM, or any framework that brings its own runtime (Vue, Svelte, …). Fyldo calls it once with an empty `<div>`. Return `{ update(props), destroy() }`: `update` runs after every change of value, disabled or invalid, and `destroy` runs when the field leaves the screen (another page or tab). Used when there is no `Component`. |
| `validate(value, props)` | Optional. It runs on blur and on save, after the `validate` rules. Return a message, or `null` when the value is valid. This is instant feedback only; the server still decides. |

You can also export the definition object itself, without the function, if you don't need the API (a `mount`-only field).

### Props of `Component` / `mount`

| | |
|---|---|
| `value` | The current value. |
| `onChange(value)` | Set a new value (any JSON value). The Save Bar appears. |
| `onBlur()` | Call it when focus leaves your control; the field is validated then. If your control opens a popup that takes focus (as `ui.Select` does), call it right after a pick instead. |
| `disabled` | The field is disabled (or its group is). |
| `invalid` | The field is showing an error. Fyldo's `ui` components turn red on their own. |
| `labelledBy`, `describedBy` | Ids of the row's title and of its description (plus the disabled reason). The row names your control as a group, so put `aria-labelledby={labelledBy}` and `aria-describedby={describedBy}` on your control, or on a `role="group"` element around several controls (then give each control its own `aria-label`). |
| `props` | The `props` from PHP. |
| `field` | `{ id, label, description }`. |
| `locale` | The page's locale, for example `fa_IR`. Format numbers with `Intl.NumberFormat(locale.replace('_', '-'))`. For the direction, read `element.closest('[dir]')`. |

### Writing JSX

You don't need a build step: `React.createElement` is enough, as in the demo. If you use a bundler, keep React external and
compile JSX with the classic runtime. The `React` you get from the API is then in scope:

```js
// esbuild fields/working-hours.jsx --bundle --format=esm --jsx=transform --outfile=fields/working-hours.js
export default ({ React, ui }) => ({
  Component: ({ value, onChange }) => <ui.Input size="md" value={value ?? ''} onValueChange={onChange} />,
});
```

## Styling

The field lives inside Fyldo's root. A scoped reset and selectors raised to ID level (docs/ARCHITECTURE.md §8.2) protect
it from wp-admin's CSS. So:

- Prefer the `ui` components. They are already styled and follow the theme and RTL.
- For your own CSS, start each selector the way Fyldo's rules start, so that it wins over the reset (which sets `margin`,
  `padding`, `border`, `color` and `font`):

  ```css
  [data-fyldo-v1][data-fyldo-v1]:not(#\#) .acme-hours { display: flex; gap: var(--fyldo-space-8); }
  ```
- Use Fyldo's tokens (`var(--fyldo-…)`, see `app/styles/tokens.generated.css`) for colours and spacing, and logical
  properties (`margin-inline-start`) for RTL.

## When something goes wrong

If the module can't be loaded, its default export has neither `Component` nor `mount`, or the component throws, the row
says "This field could not be loaded." and the console has the details. The rest of the page keeps working. The field's
value is left alone, so nothing is saved for it.
