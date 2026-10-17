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
| `module` | **Required.** URL of an ES module, either `http(s)://…` or a path starting with `/`. Fyldo `import()`s it before the page first renders, so nothing pops in. In a form whose page draws its own fields (`useForm`), `false`: Fyldo keeps and checks the value and draws nothing ([custom-pages.md](custom-pages.md#drawing-the-fields-yourself-useform)). |
| `style` | URL of a stylesheet. It is enqueued on the settings screen, after Fyldo's own CSS, once per URL. |
| `props` | An array keyed by name. It may hold only text, numbers, booleans, null and arrays, and it reaches the module unchanged. Put translated labels here, because the module has no text domain. |
| `default` | Any JSON value. Without one the value is `null`. |
| `media` | `true` when the module uses `ui.MediaPicker`: the screen then loads the WordPress media library. |
| `watch` | Ids of other fields of the same page (or form) whose current values the module gets as `values`, as the person edits them: a live preview of the page's settings ([below](#a-live-preview-watch)). Not a password field, not a group's sub-field, not the field itself. |

Every common key works as usual: `layout` (default `field`), `disabled`, `validate`, `validate_cb`, `sanitize_cb`,
`default_before`, `icon`, `badge`.

**The value** is any JSON value: text, a number, a boolean, null, or a list or array of these (nested at most 8 levels).
Fyldo cleans it the same way at every level: tags are stripped and line breaks kept (`sanitize_textarea_field`) in every
string and in every key. Anything else becomes `null`. Your `sanitize_cb` then receives that cleaned value. Your
`validate_cb` receives the sanitized value and returns `true`, `false` or a message; a message is shown under the field.
For a value with parts (a list of items), it may return messages by path inside the value instead
(`array( '2.link' => '…' )`, keyed `<field>.2.link`); a page that draws the value itself (`useForm`) shows each one
under its control, and a stored value with such messages is kept as it is.

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
| `mount(element, props)` | Plain DOM, or any framework that brings its own runtime (Vue, Svelte, …). Fyldo calls it once with an empty `<div>`. Return `{ update(props), destroy() }`: `update` runs after every change of value, disabled, invalid or a watched value, and `destroy` runs when the field leaves the screen (another page or tab). Used when there is no `Component`. |
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
| `values` | The current values of the fields named in `watch`, keyed by id: the stored ones, with the person's unsaved edits, and a field's default when nothing is stored. Read-only, and `{}` without `watch`. It is a new object only when one of them changes. |

### A live preview: `watch`

A field that shows the page's other settings as they are being edited (a preview card of a story bar, a sign with the
opening hours) names them in `watch` and draws from `values`:

```php
array(
	'id'     => 'preview',
	'type'   => 'custom',
	'label'  => __( 'Preview', 'acme' ),
	'layout' => 'stacked',
	'module' => plugins_url( 'fields/preview.js', __FILE__ ),
	'watch'  => array( 'brand_color', 'ring_style', 'theme' ),
)
```

```js
export default ({ React }) => ({
  Component: ({ values, labelledBy }) =>
    React.createElement('div', { role: 'group', 'aria-labelledby': labelledBy, style: { color: values.brand_color } }, '…'),
});
```

A field that only shows never calls `onChange`: its own value stays its default (`null`). The demo's "Opening hours" page has one (`demo/custom/hours-preview.js`).

### Writing JSX

You don't need a build step: `React.createElement` is enough, as in the demo. If you use a bundler, keep React external and
compile JSX with the classic runtime. The `React` you get from the API is then in scope:

```js
// esbuild fields/working-hours.jsx --bundle --format=esm --jsx=transform --outfile=fields/working-hours.js
export default ({ React, ui }) => ({
  Component: ({ value, onChange }) => <ui.Input size="md" value={value ?? ''} onValueChange={onChange} />,
});
```

### TypeScript

Fyldo ships the SDK's types in one file, `assets/dist/fyldo-sdk.d.ts` (Composer: `vendor/fyldo/fyldo/assets/dist/…`,
the plugin ZIP or drop-in folder: `fyldo/assets/dist/…`). It is built from the source with every release, so it
matches the Fyldo next to it: the API object (`FyldoSdk`: `React`, every `ui` component with its props, `Form`,
`useForm`), `CustomFieldExport`, `CustomFieldDefinition`, `CustomFieldProps`, `JsonValue`, and the custom page types
(`CustomPageExport`, `CustomPageProps`…). It needs `@types/react` 19 and nothing else: the only import in it is
`react`, and only for types.

The file is a module, not a global declaration, so `types` / `typeRoots` do not apply: point `paths` at it and import
its types under that name.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react",
    "strict": true,
    "noEmit": true,
    "paths": { "fyldo": ["./vendor/fyldo/fyldo/assets/dist/fyldo-sdk.d.ts"] }
  },
  "include": ["fields"]
}
```

```tsx
// fields/working-hours.tsx
import type { CustomFieldExport, CustomFieldProps } from 'fyldo';

const workingHours: CustomFieldExport = ({ React, ui }) => {
  function WorkingHours({ value, onChange, onBlur, disabled, labelledBy, props }: CustomFieldProps) {
    const [opens = '', closes = ''] = typeof value === 'string' ? value.split('-') : [];
    const times = Array.isArray(props.times) ? props.times.map(String) : [];
    const options = times.map((time) => ({ value: time, label: time }));
    const pick = (a: string, b: string) => { onChange(`${a}-${b}`); onBlur(); };

    return (
      <div role="group" aria-labelledby={labelledBy}>
        <ui.Select size="md" options={options} value={opens} aria-label="Opens" disabled={disabled} onValueChange={(v) => pick(v, closes)} />
        <ui.Select size="md" options={options} value={closes} aria-label="Closes" disabled={disabled} onValueChange={(v) => pick(opens, v)} />
      </div>
    );
  }
  return { Component: WorkingHours, validate: (value) => (value === '' ? 'Pick both times' : null) };
};

export default workingHours;
```

```sh
tsc -p .                                                   # type-check only (noEmit)
esbuild fields/working-hours.tsx --bundle --format=esm --jsx=transform --external:react --outfile=fields/working-hours.js
```

- Import Fyldo's types with `import type` only: they are erased, and nothing of Fyldo or React ends up in your bundle.
  React comes from the API at run time (`({ React, ui }) => …`). `--external:react` is a safety net: a value import
  of `react` would bundle a second React, which breaks hooks.
- `jsx: "react"` (TypeScript) and `--jsx=transform` (esbuild, the default) compile JSX to `React.createElement`, so
  the `React` you destructure from the API must be in scope wherever you write JSX: define your components inside the
  default export, as above. Do not use the automatic runtime (`react-jsx`): it imports `react/jsx-runtime`.
- A component's props: `React.ComponentProps<FyldoSdk['ui']['Select']>`.
- The file has the version it came from in its first comment. Inside v1 the SDK only grows, so a module typed against
  an older Fyldo keeps compiling against a newer one.

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
