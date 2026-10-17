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
) );
```

| Key | |
|---|---|
| `type` | `'custom'`. The default, `'settings'`, is a normal settings page. |
| `module` | **Required.** URL of an ES module, `http(s)://…` or a path starting with `/`. Fyldo `import()`s it before the first render. |
| `style` | URL of a stylesheet, enqueued on the Fyldo screen after Fyldo's own CSS, once per URL. |
| `props` | Plain data (text, numbers, booleans, null, arrays). Put translated strings here: the module has no text domain. |
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
| `ui` | Fyldo's components, with the same props as in `app/components/ui/*` and `app/components/fyldo/*`: `Button`, `ButtonLink`, `IconButton`, `Icon`, `Input`, `NumberInput`, `Textarea`, `Select`, `MultiSelect`, `Checkbox`, `RadioGroup`, `Toggle`, `SegmentedControl`, `Badge`, `Tag`, `Notice`, `EmptyState`, `Modal`, `Tooltip`, `Tabs`, `PageHeader`, `SectionCard`, `SettingRow`, and for list and dashboard screens `ItemCard`, `AddItemCard`, `Pagination`, `StatCard`. |
| `Form` | A Fyldo form for one record (below). |

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

#### Styling

Fyldo's tokens are CSS custom properties on the Fyldo root: `var(--fyldo-space-24)`, `var(--fyldo-radius-lg)`,
`var(--fyldo-text-secondary)`, `var(--fyldo-border-default)` (the full list is `app/styles/tokens.generated.css`). Use
them in the page's own stylesheet, with logical properties (`padding-inline-start`, `inset-inline-end`) so the page
mirrors in RTL. Fyldo's own utility classes are not an API: they only exist for what Fyldo itself uses.

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
