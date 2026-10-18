# Custom pages and forms

Fyldo draws settings pages from a PHP schema. Some screens are not settings: a list of records with search and paging,
an editor for one record, a dashboard of numbers. Fyldo does not grow a feature for each of them. Instead a plugin draws
such a screen itself, inside Fyldo's admin screen, and reuses what Fyldo already has:

- **Custom pages**: a page in Fyldo's navigation whose content comes from the plugin's own JavaScript module. Fyldo gives
  the module React, its components (`ui`), its form engine (`Form`), routing, toasts and a REST helper.
- **Forms**: a Fyldo field schema whose storage belongs to the plugin (its own table, a post type, an external API).
  Fyldo sanitizes, validates, detects conflicts and draws the fields exactly as on a settings page; the plugin's `load`
  and `save` callbacks read and write.

Together they cover "a list page plus an editor" without Fyldo knowing anything about the records. A working example
ships with the demo: the **Announcements** page (`demo/announcements.php`, `demo/custom/announcements.js` + `.css`): a
grid of cards with status tabs, search, sort, paging, duplicate and delete, and an editor; the records live in the
demo's own database table.

What stays in Fyldo's core: things that are generic, declarative and small (a field type, a component, a validation
rule). What belongs to the plugin: anything with its own data model or storage. When two or three plugins build the same
thing on top of this, it can move into Fyldo (docs/ARCHITECTURE.md, O19).

## Custom pages

### PHP

```php
$acme->add_page( 'stories', array(
	'type'        => 'custom',
	'title'       => __( 'Stories', 'acme' ),
	'description' => __( 'Every story on your site.', 'acme' ),
	'icon'        => 'story',
	'group'       => 'content',
	'module'      => plugins_url( 'admin/stories.js', __FILE__ ),
	'style'       => plugins_url( 'admin/stories.css', __FILE__ ), // optional
	'props'       => array(                                       // optional, reaches the module as-is
		'rest' => 'acme/v1/stories',
		'text' => array( 'add' => __( 'Add story', 'acme' ) ),
	),
	'capability'  => 'edit_posts',                               // optional, as for any page
	'media'       => true,                                       // optional: the module opens the media library
) );
```

| Key | |
|---|---|
| `type` | `'custom'`. The default, `'settings'`, is a normal settings page. |
| `module` | **Required.** URL of an ES module, `http(s)://…` or a path starting with `/`. Fyldo `import()`s it before the first render. |
| `style` | URL of a stylesheet, enqueued on the Fyldo screen after Fyldo's own CSS, once per URL. |
| `props` | Plain data (text, numbers, booleans, null, arrays). Put translated strings here: the module has no text domain. |
| `media` | `true` when the module uses `ui.MediaPicker`: the screen then loads the WordPress media library (`wp.media`). Without it, the library loads only when a settings page or form has an `image` or `file` field. |
| `title`, `description`, `icon`, `group`, `badge`, `capability` | As for a settings page. The page shows in the navigation like any other. |

A custom page has no sections, tabs, option or values. `sections`, `tabs`, `save` and `option_name` are errors.

### JavaScript

The module's default export is a function. Fyldo calls it once with the SDK and it returns the page's definition:

```js
export default function stories({ React, ui, Form }) {
  const h = React.createElement;

  function Stories({ page, path, props, navigate, request, toast, headingRef }) {
    if (path.length) return h(StoryEditor, { record: path[0], navigate, toast, headingRef });
    // … the list: request(props.rest), ui.ItemCard, ui.Pagination …
  }

  return { Component: Stories };
}
```

The definition is `{ Component }` (rendered with Fyldo's React) or `{ mount(element, props) }` returning
`{ update(props), destroy() }` for plain DOM or another framework, exactly as for [custom fields](custom-fields.md).
Do not bundle React yourself: a second copy breaks hooks. JSX works with the classic runtime and React kept external.

Fyldo renders the page inside the same content column as a settings page (960 wide, the same paddings), so a custom page
lines up with the rest. The page draws its own header (`ui.PageHeader`); Fyldo's admin notices and `header` links are
not shown on custom pages. If the module fails to load or throws, the page shows its title and a red Notice instead of
breaking the screen.

#### The SDK (first argument)

| | |
|---|---|
| `version` | `1`. Within v1 members are only added, never removed or changed. |
| `React` | Fyldo's React 19. |
| `ui` | Fyldo's components, with the same props as in `app/components/ui/*` and `app/components/fyldo/*`: `Button`, `ButtonLink`, `IconButton`, `Icon`, `Input`, `NumberInput`, `Textarea`, `Select`, `MultiSelect`, `Checkbox`, `RadioGroup`, `Toggle`, `SegmentedControl`, `Badge`, `Tag`, `Notice`, `EmptyState`, `Modal`, `Tooltip`, `Tabs`, `PageHeader`, `SectionCard`, `SettingRow`, for list and dashboard screens `ItemCard`, `AddItemCard`, `Pagination`, `StatCard`, and the controls of Fyldo's own fields for a record editor of your own: `ColorPicker`, `DatePicker`, `TimePicker`, `DateRangePicker`, `MediaPicker`, `CodeEditor`, `ChoiceCards`, `GroupItem` and `GroupList` ([below](#field-controls)). |
| `Form` | A Fyldo form for one record (below). |
| `useForm` | The same form for a page that draws the fields itself ([below](#drawing-the-fields-yourself-useform)). |

Custom fields get the same object.

#### Props of the page

| | |
|---|---|
| `page` | `{ id, title, description, icon }`. |
| `path` | The route below the page: `#/stories/42/slides` gives `['42', 'slides']`, `#/stories` gives `[]`. |
| `navigate(path, { replace })` | Go to another path of this page (`'new'`, `['42']`, `[]`). It goes through the unsaved-changes guard and pushes a history entry, so Back works. A string is split on `/` (empty parts dropped); pass an array for a segment that contains `/`. |
| `request(path, options)` | Calls a REST route of the site, relative to the REST root: `request('acme/v1/stories', { query: { paged: 2 } })`. Options: `method` (default `GET`), `data` (sent as JSON), `query`, `signal`. It sends the WordPress REST nonce `X-WP-Nonce` (refreshed once when it has expired; not Fyldo's own instance nonce), sends PUT, PATCH and DELETE as POST with `X-HTTP-Method-Override` (some hosts block them), resolves with the parsed JSON (`null` when there is no body, e.g. a 204) and rejects with an error that has `status`, `code`, `message` and `errors`. An aborted request rejects with the browser's `AbortError`. |
| `toast` | `success(message)`, `error(message, { action: { label, onClick } })`. |
| `setDirty(dirty)` | Tell Fyldo the page has unsaved edits: leaving the page (or its path) then asks first, and so does closing the tab. A `Form` does this by itself. |
| `headingRef` | A callback ref for the page's `h1`: pass it to `ui.PageHeader`'s `headingRef` (plain DOM: call `props.headingRef(h1)`). After a page or path change, focus goes there; without it, to the content column. |
| `props`, `locale`, `dir` | The `props` from PHP, the page's locale (`fa-IR`…) and direction. |

Your REST routes are your own (`register_rest_route`). Protect them with a `permission_callback` (a capability check);
WordPress checks the nonce that `request` sends.

Icons are Iconsax names (`ui.Icon`, and the `icon`, `leadingIcon`… props). Directional icons (`arrow-left`,
`arrow-right`…) mirror themselves under RTL: always pass the left-to-right name.

#### TypeScript

A page module is typed with the same file as a custom field, `assets/dist/fyldo-sdk.d.ts`, with the same `tsconfig`
(`paths` → that file, `jsx: "react"`) and the same esbuild command: see
[custom-fields.md](custom-fields.md#typescript).

```tsx
// pages/stories.tsx — esbuild pages/stories.tsx --bundle --format=esm --jsx=transform --external:react --outfile=pages/stories.js
import type { CustomPageExport, CustomPageProps } from 'fyldo';

interface Story { id: number; title: string }

const stories: CustomPageExport = ({ React, ui, Form }) => {
  function Stories({ page, path, navigate, request, toast, headingRef }: CustomPageProps) {
    const [items, setItems] = React.useState<Story[]>([]);
    React.useEffect(() => {
      request<Story[]>('acme/v1/stories').then(setItems, () => toast.error('Could not load the stories'));
    }, [request, toast]);

    if (path[0] !== undefined) return <Form form="story" record={path[0]} onSaved={(key) => navigate(key, { replace: true })} />;
    return <ui.PageHeader title={page.title} description={page.description} headingRef={headingRef} />;
  }
  return { Component: Stories };
};

export default stories;
```

`request<T>()` types the JSON it resolves with; Fyldo does not check it. `useForm`'s `field(id)` is typed as the union
of its three shapes ([below](#drawing-the-fields-yourself-useform)), since the type of a field is only known in PHP.
Name the kind of control instead, `field(id, kind)`, and the props are that control's, ready to spread:

```tsx
function Editor({ record, toast }: { record: string } & Pick<CustomPageProps, 'toast'>) {
  const form = useForm({ form: 'story', record });
  return (
    <form.Frame>
      <ui.Input size="md" {...form.field('title', 'text')} />
      <ui.Toggle {...form.field('pinned', 'toggle')} />
      <ui.MultiSelect size="md" options={tagOptions} {...form.field('tags', 'list')} />
      <ui.MediaPicker kind="image" label="Cover" onError={(message) => toast.error(message)} {...form.field('cover', 'media')} />
    </form.Frame>
  );
}
```

#### Styling

The page lives inside Fyldo's root, behind a scoped reset whose selectors are raised to ID level so wp-admin's CSS
cannot reach in (docs/ARCHITECTURE.md §8.2). The reset sets `margin`, `padding`, `border`, `color` and `font` on every
element, so **start each selector of your stylesheet the way Fyldo's rules start**, or those properties are ignored
(`display`, `gap` and grid still work, which makes the mistake easy to miss):

```css
[data-fyldo-v1][data-fyldo-v1]:not(#\#) .acme-stories-grid { display: grid; gap: var(--fyldo-space-24); padding-block-start: var(--fyldo-space-24); }
```

Fyldo's tokens are CSS custom properties on the Fyldo root: `var(--fyldo-space-24)`, `var(--fyldo-radius-lg)`,
`var(--fyldo-text-secondary)`, `var(--fyldo-border-default)` (the full list is `app/styles/tokens.generated.css`). Use
them, with logical properties (`padding-inline-start`, `inset-inline-end`) so the page mirrors in RTL. Use the semantic
tokens (`--fyldo-action-primary`, `--fyldo-text-secondary`), not the primitives (`--fyldo-gray-400`): only the semantic
tokens follow the plugin's theme ([theming.md](theming.md)). Size the layout
with container queries (`container-type: inline-size`) rather than media queries: wp-admin's menu and Fyldo's sidebar
take a varying share of the window. Fyldo's own utility classes are not an API: they only exist for what Fyldo itself
uses.

## Forms

```php
$acme->add_form( 'story', array(
	'sections'   => array(
		array(
			'id'     => 'info',
			'title'  => __( 'Story', 'acme' ),
			'fields' => array(
				array( 'id' => 'title', 'type' => 'text', 'label' => __( 'Title', 'acme' ), 'validate' => array( 'required' => true ) ),
				array( 'id' => 'cover', 'type' => 'image', 'label' => __( 'Cover', 'acme' ) ),
			),
		),
	),
	'load'       => 'acme_story_load', // ( string $key ): ?array
	'save'       => 'acme_story_save', // ( array $values, string $key ): string|WP_Error
	'capability' => 'edit_posts',      // optional
) );
```

- `sections` are the same as a settings page's, with every field type, rule, `sanitize_cb` and `validate_cb`. A form
  has no tabs and no danger sections.
- `load( $key )` returns the stored values of record `$key` (an array keyed by field id) or `null` when there is no such
  record. Missing or no longer valid values fall back to the field defaults.
- `save( $values, $key )` stores a record. `$key` is `''` for a new one. `$values` is the complete, sanitized and valid
  record: every field, with this save's changes applied. Return the record's key (the new key for a new record), or a
  `WP_Error` to refuse (its `status` is sent to the browser, default 500).
- Records are compared by a revision (a hash of what `load` returns): when someone else saved the record since it was
  opened, the save is refused and the editor offers to reload, exactly like a settings page.
- Hooks: `fyldo/{slug}/form/{id}/sanitize` and `fyldo/{slug}/form/{id}/validate` (filters, same arguments as the page
  ones), `fyldo/{slug}/form/{id}/saved` (action: `$key`, `$values`, `$stored`).

REST routes (Fyldo's namespace, same nonces and capability check as settings pages):
`GET|PATCH /forms/{form}/records/{key}` (`{key}` `new` is a new record) and `GET /forms/{form}/fields/{field}/items`
(search of `post`, `term` and `user` fields).

### In the browser

```js
h(Form, {
  form: 'story',
  record: path[0],              // 'new' or a key
  onSaved: (key, values) => {
    if (path[0] === 'new') navigate([key], { replace: true }); // the URL now names the record
  },
});
```

`Form` draws what a settings page draws under its header (24 below it): the Section Cards with their fields, the Save
Bar, the conflict notice, Ctrl/⌘+S, focus on the first invalid field. It saves as a whole: every enabled field is
checked and sent. While the record loads, the cards show the defaults, faded and inert, with a "Loading…" status, so
nothing moves when the values arrive; when the record cannot be loaded it says so and offers Retry, and a key that has
no record says the item doesn't exist. It registers its unsaved edits with the guard by itself. Changing `record` from
`'new'` to the key `onSaved` just gave does not reload the form, as long as the `Form` stays at the same place in the
tree (a remount reloads). `Form` is a React component: use it from a `Component` page, not from `mount`.

### Drawing the fields yourself: `useForm`

`Form` draws Fyldo's fields from the schema. When the editor needs more than that (fields that depend on each other, a
list the page manages itself, a live preview beside the fields), let the page draw the fields and keep Fyldo's form:
`useForm` is the same engine as `Form` (loading, the checks, saving as a whole, 422 and 409, the unsaved-changes guard,
the Save Bar), without the drawing. Nothing about saving is written twice.

```js
function StoryEditor({ record, navigate }) {
  const form = useForm({ form: 'story', record, onSaved: (key) => record === 'new' && navigate([key], { replace: true }) });
  const slides = form.values.slides;

  return h(form.Frame, null,
    h(ui.SectionCard, { title: 'Story' },
      h(ui.SettingRow, { title: 'Title', error: form.error('title') }, h(ui.Input, { size: 'md', ...form.field('title') })),
      h(ui.SettingRow, { title: 'Pinned', layout: 'inline' }, h(ui.Toggle, form.field('pinned'))),
      form.values.ends === 'on_date'           // a field that depends on another: an ordinary `if`
        ? h(ui.SettingRow, { title: 'Ends on', error: form.error('ends_at') }, h(ui.DatePicker, { size: 'md', ...form.field('ends_at') }))
        : null),
    h(Slides, {                               // the page's own list: one `custom` value
      slides,
      errorsOf: (i) => form.errorCount(`slides.${i}`),
      onChange: (next) => form.set('slides', next),
    }),
    h(Preview, { story: form.values }),       // reads the edits as they happen
  );
}
```

| | |
|---|---|
| `useForm({ form, record, onSaved })` | As `Form`'s props. One form per component: for another form, render another component (or give it a `key`). A React hook: use it from a `Component` page. |
| `status` | `loading` (the defaults are in `values`, `Frame` makes the fields inert), `ready`, `missing` or `failed` (`Frame` says why, with Retry). |
| `values` | Every field's current value: the record's, with the edits, and the defaults while it loads. |
| `field(id)` | Props for the control of a field, by its type: `{ value, onValueChange, onBlur, disabled }`, `{ checked, onCheckedChange, disabled }` for `toggle` and `checkbox`, and `ui.MediaPicker`'s `{ value, media, onValueChange, onBlur, disabled }` for `image` and `file`. `onBlur` checks the field, as Fyldo's fields do. |
| `field(id, kind)` | The props of one kind of control, the value in that control's type (`text`: `''` for a value that is not a string, and so on), so TypeScript needs no narrowing: `text` (`{ value: string, … }`: Input, Textarea, Select, RadioGroup, SegmentedControl, ChoiceCards, ColorPicker, DatePicker, TimePicker, CodeEditor), `number` (`number \| string`: NumberInput), `list` (`string[]`: MultiSelect, CheckboxGroup), `range` (`{ start, end }`: DateRangePicker), `toggle` (as `field(id)` for a toggle: Toggle, Checkbox) and `media` (as for an image: MediaPicker). A kind that does not match the field's type is reported in the console; a `custom` value binds as any kind. |
| `set(id, value, { clear })` | Set a value the page manages itself. `clear`: the message keys the edit makes stale (`['slides.2.link']`); default every message of the field. |
| `error(path)`, `errorCount(path)`, `errors` | A message, and how many there are at or under a path (`slides.2` for a slide's Group Item). Messages come from the field's `validate` rules (on blur and on save) and from the server (422). |
| `validate(id, path)` | Check a field now (on blur of a control the page draws itself); `path` checks one message key. |
| `visible(path)` | Whether a field shows for the current values (its `dependency` and its section's, [conditional fields](../README.md#conditional-fields)): draw it only then. `slides.2.link` asks about a sub-field of one item. A hidden field is neither checked nor saved. |
| `save()`, `discard()`, `dirty`, `saving` | What the Save Bar does, for a button of the page's own. |
| `invalidSaves` | Grows with every save refused for invalid values: open the items that hold errors then. `Frame` focuses the first invalid control it can find. |
| `Frame` | Draws around the page's content: the notices (loading, missing, failed, the 409 conflict), the content 24 below the header with 24 between its children, the Save Bar, Ctrl/⌘+S. |

In PHP, declare every value of the record in the form's `sections`, so the server sanitizes and checks it. A value the
page draws itself is a `custom` field with `'module' => false` (only in a form; a settings page needs a module). Its
`sanitize_cb` and `validate_cb` are yours, and `validate_cb` may answer with messages by path inside the value, which
the page shows under the right control:

```php
array(
	'id'          => 'slides',
	'type'        => 'custom',
	'label'       => __( 'Slides', 'acme' ),
	'module'      => false,               // the page draws it (useForm)
	'default'     => array(),
	'sanitize_cb' => 'acme_slides_sanitize',
	'validate_cb' => function ( $slides ) {
		$errors = array();
		foreach ( $slides as $i => $slide ) {
			if ( '' !== $slide['link'] && ! wp_http_validate_url( $slide['link'] ) ) {
				$errors[ $i . '.link' ] = __( 'Enter a full URL.', 'acme' ); // shown under slides.<i>.link
			}
		}
		return $errors;                     // array() = valid; '' => '…' is a message about the whole value
	},
),
```

A value with messages inside it is still loaded as stored (the person sees them when they save); only a message about
the whole value makes a stored value fall back to its default. Checks across fields (an end date only when "ends on a
date" is chosen) go in the form's `fyldo/{slug}/form/{id}/validate` filter.

## Field controls

The controls Fyldo's `color`, `date`, `time`, `datetime`, the range fields and `image` / `file` draw, and the Group Item
a `group` draws, for a page that keeps its record in its own state (an editor whose fields depend on each other, with a
live preview). They are the same components, so they look and behave exactly like Fyldo's fields.

Put each control in a `ui.SettingRow` (inside a `ui.SectionCard`), as Fyldo does: the row's `title` names it, its
`description` and `error` describe it. On its own (a filter in a toolbar), give it an `aria-label`. Every control writes
in the screen's language (Persian numerals and month names on a Persian screen) unless you pass `locale`.

| Component | Value | Props |
|---|---|---|
| `ColorPicker` | `#rrggbb` (lower case), `''` for none | `value`, `onValueChange`, `presets` (hex list, or `false`), `placeholder`, `size` (`sm`, `md`, `lg`; `md` in a Setting Row), `disabled`, `onBlur` |
| `DatePicker` | `Y-m-d`; with `kind: 'datetime'`, `Y-m-d H:i:s` in UTC, shown in the site's time | `value`, `onValueChange`, `kind`, `calendar` (`auto`, `gregorian`, `jalali`), `min`, `max` (a value, or `today` / `now`), `step` (minutes), `placeholder`, `size`, `disabled`, `onBlur` |
| `TimePicker` | `H:i` (24-hour) | `value`, `onValueChange`, `step`, `placeholder`, `size`, `disabled`, `onBlur` |
| `DateRangePicker` | `{ start, end }`, each as above | `value`, `onValueChange`, `kind` (`date`, `time`, `datetime`), `calendar`, `min`, `max`, `step`, `placeholder`, `startPlaceholder`, `endPlaceholder`, `size`, `disabled`, `error` (shown under it), `invalid` (the end drawn red: `start` or `end`), `onBlur`. In a Setting Row, pass the row `group`, `ownError` and `range`. |
| `MediaPicker` | The attachment ID, `0` for none | `kind` (`image` or `file`), `label` (the media library's title), `value`, `onValueChange(id, item)` (`item` describes the attachment; `0` and `null` on Remove), `onError(message)` (the chosen file is the wrong type or too large: show it as the row's `error`; `item.duration` is a video's or an audio file's length in seconds, `null` when unknown), `mimes` (e.g. `['video/mp4', 'video/webm']`), `maxSize` (bytes), `disabled`, `onBlur`. It looks the attachment up by its ID, so keeping the ID is enough. Set `'media' => true` on the page (or the custom field) so the media library is loaded. In a Setting Row, pass the row `group` and `wide`. |
| `CodeEditor` | The code, `''` for none | `value`, `onValueChange`, `language` (`css`, `html`, `json`, `text`), `rows` (lines shown, default 7), `toolbar`, `lineNumbers`, `invalidLines` (lines whose number and values turn red, from 1), `disabled`, `onBlur`. Tab indents; Escape, then Tab, leaves it. In a Setting Row, pass the row `full`. |
| `GroupItem` | | `title`, `summary` (a line under it), `preview` (an Iconsax name for the tile, `''` for an empty one), `open`, `onOpenChange`, `status` (labels after the title that say what holds for the item without opening it: `[{ label: 'Scheduled', tone: 'blue', icon: 'clock' }]`, tones as for `Badge`; usually one), `inactive` (the item is kept but not in effect: its preview, title and summary fade; it stays editable; add an "Inactive" `status` too, since fading says nothing to a screen reader), `errorCount` (a red border and "2 errors" while it is invalid), `actions` (your `ui.IconButton`s), `children` (the item's fields, drawn while open). For a list of them use `GroupList`, which draws Group Items for you. Figma: Group Item's `Status` badge and `State=Inactive`. |
| `GroupList` | Your items, in order (any values) | Figma "Group" without a schema: the list the `group` field draws, for items the page keeps itself (slides, sections). `items`, `onChange(items)` (after a move, an add, a duplicate, a removal or its Undo, or an item's edit), `title(item, index)` (empty: "Item 2"), `summary`, `preview`, `status`, `inactive`, `errorCount` (each `(item, index) => …`, as on Group Item), `children(item, index, update)` (the open item's fields; `update(next)` replaces it), `sortable` (a drag handle: pointer, or Space, the arrows, Space, Escape; every step announced), `addable` with `create()` (Add at the end, Duplicate below, Remove with Undo), `copy`, `min`, `max` (with a count next to Add), `addLabel`, `disabled`, `reveal` (grows on a refused save: the first item with errors opens, e.g. `form.invalidSaves`), `locale`. In a Setting Row pass the row `group` and `full`; on its own give it an `aria-label`. |
| `ChoiceCards` | The chosen option's `value` | `options` (`{ value, label, description?, image?, disabled? }`), `content` (`image_text`, `image`, `text`), `columns` (2, 3, 4), `value`, `onValueChange`, `disabled`, `onBlur`. A radio group: the arrow keys move the choice. In a Setting Row pass the row `group` and `cards`. |

`onValueChange` gives the new value, `onBlur` says the person has left the control (the moment Fyldo's fields validate).
The values are the formats Fyldo's own fields store, so PHP reads them the same way (`Support\Dates::to_site()` for a
datetime).

## Components for list and dashboard pages

Designed in Figma (sets **Item Card**, **Pagination**, **Stat Card**; Modal's **Content** slot) and in the design pack:

- `ItemCard`: one record in a grid of three. `title`, `meta` (a short count beside it), `description`, `media` (your
  own content: a cover, an avatar), `status` and `flag` (Badges at the top), `tags`, `details` (up to two
  `{ icon, label }` in the footer), `actions` (Tertiary `IconButton`s), `onOpen` / `href` (the whole card opens the
  record; the action buttons stay separate). `AddItemCard` (`title`, `description`, `onClick` / `href`) closes the grid.
- `Pagination`: `page` (from 1), `pageCount`, `onPageChange`, `summary` ("Showing 1–8 of 24"). Nothing is drawn for a
  single page; the arrows mirror in RTL.
- `StatCard`: `label`, `value`, `icon`, `delta` (`{ value, trend: 'up' | 'down' | 'neutral', tone }`; the colour follows
  `tone`, which defaults to green for up and red for down) and `comparison` ("vs previous 30 days").
- `Modal` takes `children`: a few controls between the text and the buttons, such as "Also delete its image".

The usage frames in `design/figma/png/usage/` (`item-card-usage.png`, `pagination-usage.png`, `stat-card-usage.png`,
`modal-usage.png`) show them in context.
