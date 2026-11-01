# Fyldo

A settings-page framework for WordPress plugin developers. Declare **pages → sections → fields** in PHP; Fyldo renders a React admin UI (Vercel/Geist look, English + Persian/RTL) and sanitizes, validates and saves the values through the REST API.

> **Status: `1.0.0-beta.5`.** Feature-complete for 1.0, API not yet frozen. Requires PHP 7.4+ and WordPress 6.5+. Not published on wordpress.org. Version history: [CHANGELOG.md](CHANGELOG.md).

**Contents:** [Install](#install) · [Config reference](#config-reference) · [Coexistence and Strauss](#coexistence-and-strauss) · [Contributing](#contributing) · [فارسی](#فارسی)

## Install

One tree, three ways to load it. The code that uses Fyldo is the same in all three. Prebuilt assets are included everywhere: nobody needs Node.

### 1. Standalone plugin (ZIP)

Download `fyldo.zip` from the [GitHub Releases](https://github.com/SaeedCodez/fyldo/releases) page and install it from **Plugins → Add New → Upload Plugin**. Activate it, then use the API from your own plugin (a demo dashboard under **Settings → Fyldo demo** shows every field type. It is off by default: turn it on with `add_filter( 'fyldo/fyldo-demo/enabled', '__return_true' );`, for example in a mu-plugin. It never loads in drop-in or Composer mode, and deleting the Fyldo plugin removes its table and options):

```php
// my-plugin.php — header: "Requires Plugins: fyldo" only checks that Fyldo is active (WordPress cannot install it for the user).
use Fyldo\V1\Fyldo;

add_action( 'init', static function () {
	Fyldo::create( 'acme-seo' )->add_page( 'general', [ 'title' => 'General', 'sections' => [ [
		'id' => 'main', 'title' => 'Main', 'fields' => [ [ 'id' => 'site_title', 'type' => 'text', 'label' => 'Site title' ] ],
	] ] ] );
} );
```

### 2. Drop-in folder

Unzip `fyldo.zip` into your plugin (you get `my-plugin/fyldo/`) and include it:

```php
require_once __DIR__ . '/fyldo/fyldo.php';   // then the same Fyldo::create() code as above, on `init`
```

Example: [examples/acme-example-dropin](examples/acme-example-dropin) (with an `uninstall.php`).

### 3. Composer

```bash
composer require fyldo/fyldo
```

Until Fyldo is on Packagist, add the repository first: `composer config repositories.fyldo vcs https://github.com/SaeedCodez/fyldo`. Release tags carry the prebuilt assets (`main` does not).

```php
require_once __DIR__ . '/vendor/autoload.php';   // Composer only loads fyldo.php; there is no PSR-4 map on purpose
// then the same Fyldo::create() code as above, on `init`
```

Example: [examples/acme-example-composer](examples/acme-example-composer). All four examples are listed in [examples/README.md](examples/README.md) and tested in CI.

## Config reference

Create instances on `init` (by then the winning copy is chosen). Values are stored per page in the option `{slug}_{page}` (autoload off) and read with `Fyldo::instance( 'acme-seo' )->get( 'general', 'site_title' )`, `->all( 'general' )` and `->update( 'general', [ … ] )`.

```php
$fyldo = Fyldo::create( 'acme-seo', [                // slug: a-z, 0-9, "-", 3–40 characters, unique per site
	'title'      => 'Acme SEO',                       // brand name (default "Fyldo")
	'logo'       => 'chart-2',                        // an Iconsax name or an image URL (default: the Fyldo mark)
	'theme'      => [ 'brand' => [ 600 => '#ff6b4a', 700 => '#c8401f' ] ], // your own colours (default: Fyldo's)
	'version'    => ACME_SEO_VERSION,                 // shown in the sidebar; also lets `default_before` keep old defaults
	'capability' => 'manage_options',                 // default for every page and REST route
	'navigation' => 'sidebar',                        // 'sidebar' (default) | 'top'
	'menu'       => [ 'type' => 'submenu', 'parent' => 'options-general.php', 'title' => 'Acme SEO' ], // or 'type' => 'top'
	'links'      => [ [ 'label' => 'Docs', 'url' => 'https://acme.test/docs', 'icon' => 'book', 'external' => true ] ],
] );

$fyldo->add_group( 'settings', 'Settings' );          // labels the sidebar (dividers in the top navigation)

$fyldo->add_page( 'general', [
	'title'       => 'General',
	'description' => 'Identity and privacy.',
	'icon'        => 'setting-2',                     // any Iconsax name
	'group'       => 'settings',
	'save'        => 'global',                        // 'global' (Save Bar) | 'section' (a Save button in each card)
	'badge'       => 3,                               // optional count on the nav item
	'links'       => [ [ 'label' => 'Guide', 'url' => 'https://acme.test/docs/general', 'external' => true ] ], // this page's Page Header buttons
	'tabs'        => [ 'identity' => 'Identity', 'reading' => [ 'label' => 'Reading', 'icon' => 'book-1' ] ],
	'sections'    => [
		[
			'id' => 'identity', 'tab' => 'identity', 'title' => 'Site identity',
			'fields' => [
				[ 'id' => 'site_title', 'type' => 'text', 'label' => 'Site title', 'default' => 'My site',
				  'validate' => [ 'required' => true, 'max_length' => 60 ] ],
			],
		],
		[  // Danger section: always last, no fields, one confirmed action
			'id' => 'danger', 'tone' => 'danger', 'title' => 'Reset settings',
			'description' => 'Restore every option on this page to its default.',
			'action' => [ 'id' => 'reset', 'label' => 'Reset', 'confirm' => [ 'title' => 'Reset all settings?', 'keyword' => 'RESET' ] ],
		],
	],
] );
```

### Fields

Every field takes `id`, `type`, `label`, `description`, `default`, `default_before`, `disabled` (`true` or a reason string), `icon`, `layout`, `dependency` ([conditional fields](#conditional-fields)), `validate`, `sanitize_cb` and `validate_cb`.

`layout` sets where the control sits in its row: `inline` (at the end, for on/off controls), `stacked` (under the description) or `field` (an input at the end of the row, error under it; stacked on narrow screens). The default is `field` for every type except `choice`, `code`, `group`, `notice` and the ranges (`date_range`, `time_range`, `datetime_range`), which are `stacked` (they are too wide to sit beside the label), and `toggle`/`checkbox` (`inline`). Set it only to override.

| `type` | Notes |
|---|---|
| `text` `url` `email` | `placeholder`. `url` accepts `validate.schemes`. |
| `password` | Write-only: never sent to the browser. No `default`. |
| `number` | `min` `max` `step`, set on the field (`validate` takes them too). Persian and Arabic-Indic digits are read as ASCII. |
| `textarea` | `rows`. With `validate.max_length` it shows a live counter. |
| `code` | Code in the Code Editor: line numbers, syntax colours, a copy button, Tab indents (Escape then Tab leaves), always left to right. `language` is `css`, `html`, `json` or `text` (default), `rows` the lines shown (default 7), `toolbar` and `line_numbers` (default true). **The value is the code as typed**, so escape it where you print it ([Escaping](#escaping)). Saved by someone who may not post unfiltered HTML, `html` and `text` go through `wp_kses_post()` and `json` has `<` and `>` written as `\u003C` and `\u003E` (the same JSON); `css` is kept as typed (`@import` and `url()` pass). This happens on save only, never when a value is read. JSON must parse and CSS may hold no markup (WordPress's own check; stored CSS with markup reads as the default); a CSS message names its line, and `validate_cb` may return messages by line (`[ 3 => '…' ]`). Layout default `stacked`, full width. |
| `toggle` `checkbox` | A boolean. |
| `checkbox_group` `radio` `select` `multi_select` | `options`: `[ 'value' => 'Label' ]`, a list of `[ 'value', 'label', 'disabled' ]`, or a callable. `radio` needs a `default`. `select` and `multi_select` take `searchable`. `checkbox_group` and `multi_select` take `min` / `max` (how many options may be chosen), set on the field (`validate` takes them too). |
| `post` `term` `user` | Pick posts (pages, products, any post type), terms (categories, tags, any taxonomy) or users **by searching for them**: a Select (or, with `multiple`, a Multi Select) whose options come from the server while the user types, 20 at a time (more load as the menu is scrolled); before anything is typed it lists the most recent items (terms and users by name). `post_type` (a name or a list, default `post`) and `post_status` (default `publish`) for `post`, `taxonomy` (a name or a list, default `category`) for `term`, `role` (a name or a list; none = every user) for `user`. With several post types or taxonomies each result names its type (“Summer sale · Page”); a user shows the login when it differs from the display name. `multiple` (default `false`), `placeholder`, and `query_args` (extra arguments for `WP_Query` / `get_terms()` / `get_users()`, e.g. `[ 'author' => 3 ]`; the search, paging and source cannot be overridden). **The stored value is the ID** (an integer, `0` = none), or with `multiple` a list of IDs in the order they were picked; read it with `get_permalink( $id )`, `get_term( $id )` or `get_userdata( $id )`. Only items the current user may read are offered and saved (`read_post` for posts, the taxonomy's `assign_terms` for terms, `list_users` for users; email addresses are never searched or sent). An item that is deleted or no longer fits the field drops out of the value when it is read, so a page never shows a bare ID. `validate.required`; with `multiple`, `min` / `max` (the number of items), set on the field (`validate` takes them too). Works inside a `group`. Search route: `GET …/pages/{page}/fields/{field}/items` (`search`, `paged`, or `include` = comma-separated IDs), under the page's capability. Layout default `field`. |
| `choice` | A Choice Card Group: exactly one of a few selectable cards (single choice, like `radio`). `options` as for `radio`, plus per option `description` and `image` (an `http(s)` URL or a path starting with `/`); every option needs a `label`, which names the card even when only the image shows. `content`: `auto` (default: every option has an `image` → image and text, none has → text only, a mix is a configuration error), `image` (images only, every option needs one) or `text` (ignores images). `columns`: `2` (default), `3` or `4`; up to 782px wide at most 2, up to 480px one. Nothing selected is an error (`required`), so a `default` is optional; if given it must be an enabled option. |
| `segmented` | A Segmented Control: exactly one of 2–5 short `options` (same forms as `radio`, without descriptions). Needs a `default` that is an enabled option. |
| `slider` | A number in a bounded range, picked with a single thumb. `min` (default `0`), `max` (`100`) and `step` (`1`) are set on the field; they are exported as the `min` / `max` / `step` rules, so a value outside the range or off the step is rejected in PHP and in the browser (nothing is clamped silently). `default` is `min` unless given. |
| `color` | One free colour: a swatch and its hex value that open a picker (saturation/brightness area, hue strip, hex box, presets). Stored as lower-case `#rrggbb`, no alpha; typed text such as `#ABC` or `2271b1` is read as `#aabbcc` / `#2271b1`. `default` is a hex colour (none by default); `presets` is a list of hex colours (default: the 16 of the design) or `false` to hide the section; a non-hex preset is a configuration error. Empty is allowed unless `validate.required`. |
| `icon` | One icon from the Iconsax Linear library: a preview tile and the icon's name that open a modal with a search box and a scrolling icon grid. Stored as the kebab-case name, e.g. `setting-2` (the same names as the `icon` option). `default` is an icon name (none by default). `icons` is an optional list of names that restricts both the picker and the server-side check; without it the server accepts any Iconsax name Fyldo has (`Fyldo::is_icon()`) and refuses the rest. Layout default `field`; `validate.required` is supported. |
| `date` `time` `datetime` | One day, one time of day, or one moment. `date` and `datetime` open a calendar (Days, Months and Years views, Today / Clear; a datetime has hour and minute columns beside it); `time` is typed as HH:MM (Persian and Arabic digits are read, `930` is 09:30) or picked from hour and minute columns with Now. Dates show in the **Jalali (Shamsi) or the Gregorian calendar**: `calendar` is `auto` (default: Jalali when the site locale starts with `fa`, else Gregorian, with a Gregorian/Jalali switch in the panel), `jalali` or `gregorian` (locked, no switch); the switch only changes what is shown. Under a filled field the same value is written in the other calendar. Jalali weeks start on Saturday, Gregorian ones on the site's “Week starts on”. **What is stored is always Gregorian**: a date `Y-m-d`, a time `H:i` (24-hour), a datetime `Y-m-d H:i:s` **in UTC** (like `post_date_gmt`; it is shown and picked in the site's time zone, `wp_timezone()`); empty is `''`. `min` / `max` take a value in that format, or `'today'` (date) / `'now'` (datetime), resolved in the site's time zone; days outside are disabled in the calendar. `step` is minutes for `time` and `datetime` (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30 or 60; default 1); a datetime's step counts site-time minutes. `placeholder`. The server checks every value again (the strict format, a real day: no 30 February, 00:00–23:59, `min`, `max`, the step) and never trusts the browser's conversion; anything else is a field error and nothing is saved. Read a datetime in the site's time zone with `\Fyldo\V1\Support\Dates::to_site( $utc )` (a `DateTimeImmutable`, or `null` for empty / invalid), e.g. `Dates::to_site( $o['sale_starts'] )?->format( 'Y-m-d H:i' )` on PHP 8, or `wp_date( get_option( 'date_format' ), Dates::to_site( $utc )->getTimestamp() )`. Works inside a `group`. Layout default `field`. |
| `date_range` `time_range` `datetime_range` | A start → end pair of the single type: two inputs, each the single picker (its own calendar or time panel), with an arrow between them and the length under them once both are set ("Duration: 7 days", "Duration: 6 days, 9 hours and 30 minutes"). **The stored value is one array** `array( 'start' => …, 'end' => … )`, each end in the single type's format (a date `Y-m-d`, a time `H:i`, a datetime `Y-m-d H:i:s` in UTC); empty is `array( 'start' => '', 'end' => '' )`. Config: the single type's `calendar`, `min`, `max`, `step` and `placeholder`, applied to both ends, plus `start_placeholder` / `end_placeholder`; `default` is such a pair. A date or datetime end opens on the start's month with every day before the start disabled, and moving the start past the end clears the end. `date_range` counts both days (Oct 20 → Oct 26 is 7 days; the end may be the start's day). `datetime_range` needs an end strictly after the start; its duration is the real time between the two UTC values (a daylight-saving change in between is counted). `time_range` may **cross midnight**: an end earlier than the start is the next day (22:00 → 06:00 is 8 hours, "ends the next day"); an end equal to the start is an error. The server checks the pair on every save: each end passes the single type's rule (format, `min`, `max`, `step`), both ends are set or both empty, and the order above; unknown keys are dropped and anything that is not an array is empty. Helpers: `\Fyldo\V1\Support\Dates::range_to_site( $range )` returns both ends of a `datetime_range` as `DateTimeImmutable` in the site's time zone (`null` for an empty end), e.g. `list( $from, $to ) = Dates::range_to_site( $o['campaign'] );`, and `Dates::time_in_range( $range, $time = null )` tells whether a time (`H:i`; default now on the site's clock) is inside a `time_range`, the start included and the end excluded, overnight ranges handled: `if ( Dates::time_in_range( $o['quiet_hours'] ) ) { … }`. Works inside a `group`. Layout default `stacked` (the field is 480 wide). |
| `image` | One image from the WordPress media library: a thumbnail, the file name with its dimensions and size, and **Select image** / **Replace** and a remove button. The field only opens WordPress's own media modal (`wp.media`); Fyldo has no uploader, and the buttons stay inert where `wp.media` is not loaded. **The stored value is the attachment ID** (an integer, `0` = none): the name, size and dimensions are read from the attachment, never from a URL, and removing only clears the value; it never deletes the file from the media library. Read it with `wp_get_attachment_image_url( (int) $value, 'full' )` (or `wp_get_attachment_image( (int) $value, 'medium' )`). `types` (optional) narrows the accepted extensions to image ones, e.g. `[ 'png', 'webp' ]` or the `'image'` group (mapped to MIME types with `wp_get_mime_types()`; an unknown extension throws a `ConfigException`; default: every image type). `max_size` (optional) is a number of bytes or text such as `'2MB'` (an invalid value throws a `ConfigException`). A picked file of the wrong type or over the size shows the field's error and the value does not change; the server checks again on save (the attachment must exist and be readable by the current user, be an image, be one of `types` and not exceed `max_size`). Reading a saved value (`get()`, also on the front end for logged-out visitors) only needs the attachment to still exist and fit the field. Layout default `field`; `validate.required` means "an attachment is chosen". |
| `file` | One file from the WordPress media library (a PDF, an archive, an Office document, any type you allow): a file tile, the file name with its type and size, and **Select file** / **Replace** and a remove button. Same behaviour and checks as `image`; **the stored value is the attachment ID** (`0` = none). Read it with `wp_get_attachment_url( (int) $value )` (or `get_attached_file( (int) $value )` for the path). `types` (optional) takes extensions or WordPress type groups such as `'image'` and `'document'` (`image`, `audio`, `video`, `document`, `spreadsheet`, `interactive`, `text`, `archive`, `code`, from `wp_get_ext_types()`), e.g. `[ 'document', 'archive', 'image' ]` or `[ 'pdf', 'zip' ]`; it limits both the media modal and the server check. Without `types` the field accepts every type WordPress allows, images included. `max_size` as for `image`. |
| `group` | A list of items that share the same sub-fields, e.g. header buttons with a label, an icon and a link. `fields` is a list of ordinary field configs (any type except `group`, `image`, `file`, `password` and `notice`; sub-field ids are unique inside the group). **The stored value is a list of arrays keyed by sub-field id**, in the order shown, e.g. `[ [ 'label' => 'Docs', 'icon' => 'book', 'link' => 'https://…' ], … ]`. `addable` (default `false`): Add (a new item at the end, opened), Duplicate and Remove (at once, with Undo in a toast). Without it the group is **fixed**: it always holds exactly the items of `default`, which is then required. `sortable` (default `false`): a drag handle per item; with the keyboard, Space picks an item up, the arrow keys move it, Space drops it and Escape puts it back. `min` / `max` (only with `addable`) limit the number of items; the count next to Add shows the limit. `item_title` names an item after one of its sub-fields (otherwise "Item 1", "Item 2"…); when that sub-field is a `post`, `term` or `user` field, the item takes the chosen item's title, so nobody has to type it, `item_icon` shows an `icon` sub-field as the item's preview tile, `add_label` is the Add button's text. Each sub-field validates as on its own; its error is keyed `<group>.<index>.<sub-field>` in the REST 422 and the `page/<page>/validate` filter, and a failed save opens the first item with an error. `validate.required` (at least one item) is the only rule of the group itself; `validate_cb` receives the whole list once every item is valid. A stored sub-field value that no longer validates reads as that sub-field's `default`. |
| `custom` | A control you draw yourself, in React or plain JavaScript: `module` is the URL of an ES module whose default export receives Fyldo's React and a few of its components (`ui.Select`, `ui.Input`…) and returns a `Component` (or a `mount` function), plus an optional `validate`. `props` (an array keyed by name) reaches the module as-is: put translated labels there. `style` is a stylesheet to enqueue with the screen. `watch` names other fields of the page whose current values the module gets as you edit them (a live preview). The value is any JSON value, its text cleaned like a textarea's; `validate_cb` is the check that counts. Works inside a `group`. See [docs/custom-fields.md](docs/custom-fields.md) and the demo's "Opening hours" page (two selects saved as one value). |
| `notice` | Display only, never stored: `description`, `tone` (`gray` `blue` `green` `amber` `red`). |

`validate` keys: `required`, `min_length`, `max_length`, `pattern`, `min`, `max`, `step`, `schemes`, `allowed`. One rule for bounds and counts: they are keys of the field (`slider`, the dates and ranges, `group`, `number`, the lists, `post`/`term`/`user` with `multiple`), and `validate` accepts them too for `number` and the lists; giving the same key in both places is a config error. (A date, time, range or slider field takes its bounds on the field only.) They run in PHP **and** in the browser. `validate_cb( $value )` (return `true`, `false` or a message) and `sanitize_cb` are PHP-only; the server is authoritative.

### Conditional fields

`dependency` shows a field only while a condition on other fields of the page holds, as in Codestar Framework. It is live: the field appears (and disappears) as the values change, before anything is saved.

```php
[ 'id' => 'cache', 'type' => 'toggle', 'label' => 'Cache pages' ],
[ 'id' => 'driver', 'type' => 'select', 'label' => 'Driver', 'options' => [ 'file' => 'Files', 'redis' => 'Redis', 'memcached' => 'Memcached' ],
  'dependency' => [ 'cache', '==', true ] ],
[ 'id' => 'host', 'type' => 'text', 'label' => 'Server', 'validate' => [ 'required' => true ],
  'dependency' => [                                  // every condition must hold…
	[ 'cache', '==', true ],
	[ 'driver', 'any', [ 'redis', 'memcached' ] ],
  ] ],
[ 'id' => 'hint', 'type' => 'notice', 'description' => 'Add a logo or a tagline first.',
  'dependency' => [ 'relation' => 'or', [ 'logo', 'empty' ], [ 'tagline', 'empty' ] ] ],  // …or, with `or`, one of them
```

- **Operators:** `==` `!=` `>` `>=` `<` `<=` `any` `not-any` (the value is a list) `contains` `not-contains` (text inside text, or a value in a list field) `empty` `not-empty` (no value: `[ 'logo', 'not-empty' ]`). A list field (`checkbox_group`, `multi_select`) `==` a value it holds; a toggle compares with `true`, `'true'` or `1`; numbers and numeric text compare as numbers, dates and times in their stored format compare in order. An image, file, post, term or user field with nothing chosen is `empty`.
- **Where:** any field, a `notice`, a `group`'s sub-field (its conditions read the other sub-fields of the same item first, then the page) and a **section** (`'dependency'` on the section hides the whole card; a card whose fields are all hidden hides too). Conditions see every field of the page, in any section or tab.
- **Hiding cascades:** a condition on a hidden field never holds, so in the example `host` hides when `cache` is switched off even though `driver` still says `redis`.
- **A hidden field is not part of the form:** it is not checked (a hidden `required` field never blocks a save) and not saved; what is stored stays, and `get()` keeps returning it, so check the controlling value in your code too (`if ( $o['cache'] ) { … $o['host'] … }`). Edits made to a field before it was hidden wait in the page and are saved if it shows again. Inside a group item a hidden sub-field, like a disabled one, is not checked and not saved: it keeps the value a stored item holds (the stored item at the same position; a new item gets the sub-field's `default`).
- PHP checks the conditions when the page is registered: unknown ids, password fields (their value never reaches the browser), notices, a field or section that depends on itself, and circles (`a` shows when `b` does and `b` when `a` does) are configuration errors. The demo's General page shows a coming-soon message only while maintenance mode is on.

### Changing a default

A field nobody saved has nothing stored, so it reads `default` from your code; changing `default` in a release changes every such site. To keep the old value for them, list it in `default_before`, keyed by the version that introduced the new default:

```php
[ 'id' => 'posts_per_page', 'type' => 'number', 'label' => 'Posts per page',
  'default' => 30, 'default_before' => [ '2.0.0' => 10, '3.0.0' => 20 ] ],  // needs the instance `version`
```

Fyldo remembers the version each page last ran (option `{slug}__fyldo`) and, when it moves forward, stores the default each untouched field had in that version. Saved values are never touched; new installs get today's default. Details and edge cases: [docs/default-history.md](docs/default-history.md).

### Save modes

`'save' => 'global'` shows one Save Bar for the page (Ctrl/⌘+S works, and leaving with unsaved changes asks first). `'save' => 'section'` puts a Save button in each Section Card footer. Pick one per page. If two people edit the same page, the second save gets a conflict notice and keeps their edits.

### Logo and title

`title` is the brand name and the default admin-menu label. `logo` is an [Iconsax](https://iconsax.io) name (drawn at 24px) or an image URL (drawn 24×24). Without one, the Fyldo mark is shown.

### Theme

`theme` gives the screen your own colours: a `brand` ramp (`50`–`950`; `600` is the primary button, toggles and focus, `700` links and hovers) and a `neutral` ramp (backgrounds, borders, text, the dialog scrim). Leave out any step to keep Fyldo's colour. Every field, component and custom page follows the theme; the status colours do not. The steps are the variables of the Theme collection in Fyldo's Figma file. A project adds its own mode there and passes its values: [docs/theming.md](docs/theming.md).

### Notices

```php
$fyldo->admin_notice( 'Your license expires in 7 days.', [
	'tone'   => 'amber',                      // gray | blue | green | amber | red
	'title'  => 'License',
	'page'   => 'general',                    // only on this page (default: every page)
	'action' => [ 'label' => 'Renew', 'url' => 'https://acme.test/renew', 'external' => true ],
] );
```

Call it before the screen loads (`init`, `admin_init`). Fyldo draws it in its own slot, not with WordPress's `.notice` markup. Keep the stack to 3 or fewer. Plain text only.

### Danger actions

A section with `'tone' => 'danger'` has no fields, only an `action`. The only built-in action id is `reset` (restore the page's defaults). A `keyword` in `confirm` makes the user type it before the button enables. The server checks nonce, capability and keyword. `$fyldo->reset( 'general' )` does the same from code.

### Custom pages and forms

Screens that are not settings (a list of records, an editor for one, a dashboard) are drawn by your plugin, inside
Fyldo's screen, with Fyldo's components:

```php
$fyldo->add_page( 'stories', [
	'type'   => 'custom',                                        // your module draws the page
	'title'  => __( 'Stories', 'acme' ),
	'module' => plugins_url( 'admin/stories.js', __FILE__ ),     // default export: ({ React, ui, Form }) => ({ Component })
	'style'  => plugins_url( 'admin/stories.css', __FILE__ ),
	'props'  => [ 'rest' => 'acme/v1/stories' ],
] );

$fyldo->add_form( 'story', [                                     // fields validated by Fyldo, records stored by you
	'sections' => [ /* as on a page */ ],
	'load'     => 'acme_story_load',                             // ( string $key ): ?array
	'save'     => 'acme_story_save',                             // ( array $values, string $key ): string|WP_Error
] );
```

The page's component gets `path` (`#/stories/42` → `['42']`), `navigate`, `request` (your REST routes, with the nonce),
`toast`, `setDirty` and `headingRef`; `ui` has Fyldo's components (including `ItemCard`, `Pagination`, `StatCard` and the
field controls `ColorPicker`, `DatePicker`, `MediaPicker`, `GroupItem`…) and `Form` draws a form for one record with the
Save Bar and validation. When the page draws the fields itself (fields that depend on each other, a live preview),
`useForm` keeps Fyldo's loading, validation and saving and leaves the drawing to you. The demo's "Announcements" page is a complete
example (a list with search, tabs, paging and a delete dialog, an editor, its own database table). See
[docs/custom-pages.md](docs/custom-pages.md).

### Icons outside Fyldo

A page Fyldo does not draw (your site's front end, an email, a shortcode) can still use Fyldo's Iconsax set, one icon at a
time: PHP reads only that icon's module and gives back its markup, so the page never loads the whole set.

```php
use Fyldo\V1\Fyldo;

echo Fyldo::icon( 'heart' );                                        // <svg viewBox="0 0 24 24" fill="none" … aria-hidden="true" …>…</svg>
echo Fyldo::icon( 'home-2', [ 'size' => 20, 'class' => 'acme-icon', 'label' => 'Home' ] ); // width/height, class, role="img" + aria-label
Fyldo::is_icon( $value );                                           // check a stored or submitted name
```

The name is the kebab-case Iconsax name the `icon` field stores (Linear, the only variant Fyldo ships). The markup is a
24×24 viewBox drawn in `currentColor` (colour it with CSS `color`), decorative unless given a `label`, with a fixed set of
elements and attributes (no script, no event handlers). An unknown name gives `''`; only names from Fyldo's own list are
read, so a name can never point at another file. Each icon is read once per request. A custom page that draws outside
React (a shadow root, a preview of your site) gets the same markup in the browser from the SDK:
`await sdk.iconSvg( 'heart' )` ([docs/custom-pages.md](docs/custom-pages.md#the-sdk-first-argument)).

### Uninstall

Fyldo never deletes your data (deleting the Fyldo plugin itself removes only its demo's table and options). In your plugin's `uninstall.php`, load Fyldo, register your instance and pages the same way as on `init` (keep that code in a function you can call), then call `delete_data()`. It deletes every registered page's option and Fyldo's own `{slug}__fyldo`, and fires no hooks.

```php
// uninstall.php
defined( 'WP_UNINSTALL_PLUGIN' ) || exit;
require_once __DIR__ . '/fyldo/fyldo.php';   // or vendor/autoload.php
require_once __DIR__ . '/includes/settings.php';
acme_seo_register_settings();                 // the function your plugin hooks on `init`
\Fyldo\V1\Fyldo::instance( 'acme-seo' )->delete_data();
```

On multisite, run it for each site (`switch_to_blog()`).

### Hooks

A settings page, with `{slug}` your instance slug:

| Hook | Kind | Arguments |
|---|---|---|
| `fyldo/{slug}/before_save` | action | `$page_id, $new, $old`: before a page's option is written |
| `fyldo/{slug}/saved` | action | `$page_id, $new, $old`: after it was written (also after a reset) |
| `fyldo/{slug}/reset` | action | `$page_id, $stored_before`: after a page was reset to its defaults |
| `fyldo/{slug}/upgraded` | action | `$page_id, $from, $to`: once per page when the instance `version` moves forward |
| `fyldo/{slug}/page/{page}/sanitize` | filter | `$clean, $stored`: the sanitized values of the changed fields |
| `fyldo/{slug}/page/{page}/validate` | filter | `$errors, $clean, $stored`: field id => message; a non-empty array blocks the save |

A form (`add_form()`), with `{form}` its id. A form's save never fires a page's hooks:

| Hook | Kind | Arguments |
|---|---|---|
| `fyldo/{slug}/form/{form}/sanitize` | filter | `$clean, $stored` |
| `fyldo/{slug}/form/{form}/validate` | filter | `$errors, $clean, $stored` |
| `fyldo/{slug}/form/{form}/saved` | action | `$key, $values, $stored`: after your `save` callback stored the record |

And two more: `fyldo/{slug}/assets_url` (filter, `$url, $path`: the URL of Fyldo's `assets/dist` directory, for a symlinked or unusual install) and `fyldo/{slug}/config` (filter, internal: see below).

### Escaping

Fyldo **sanitizes** values when they are saved; it does not **escape** them for you. Escape where you print:
`esc_html()` for text, `esc_attr()` inside an attribute, `esc_url()` for a link.

- In a `custom` field's `mount` module, or a custom page drawn without React, put labels and values in the DOM with
  `textContent`, never `innerHTML`.
- `code` field: print CSS with `wp_add_inline_style()`. JSON inside a `<script>` tag is safe only as Fyldo stores it for
  users without `unfiltered_html` (`<` and `>` written as `\u003C` and `\u003E`); an admin with that capability may
  save anything, so if you build the JSON yourself, encode it with `wp_json_encode()`. CSS keeps `@import` and `url()`.
- `query_args` of a `post`, `term` or `user` field only narrows the search; a request can still send another ID. To
  enforce it, check the value in `validate_cb`.
- IDs saved through `Instance::update()`, and IDs inside a `custom` field's value, are not checked against any user
  (a `post`, `term` or `user` field saved from the screen is). Check them yourself when a user chose them.

### Good to know

- **Public API.** What you can rely on in 1.x is listed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §3.2. Anything marked `@internal` may change in any release.
- **Errors.** `Fyldo::create()` throws `Fyldo\V1\Schema\ConfigException` for a bad slug or instance config (a duplicate slug is reported and returns the existing instance). Mistakes in a group, page, form or notice are reported with `_doing_it_wrong()` and that item is skipped, so a typo never takes the site down.
- **Option names are unique.** A page's option (`{slug}_{page}`, or its `option_name`) belongs to one page of one instance, and is never `{slug}__fyldo`; otherwise the page is rejected, because two pages on one option overwrite each other.
- **Empty values.** What a field holds when nothing is chosen or typed:

  | Empty value | Field types |
  |---|---|
  | `''` | `text` `url` `email` `password` `textarea` `code` `number` `select` `color` `icon` `date` `time` `datetime` |
  | `false` | `toggle` `checkbox` |
  | `0` | `image` `file` `post` `term` `user` |
  | `[]` | `checkbox_group` `multi_select` `group` `post` `term` `user` with `multiple` |
  | `null` | `custom` (until the module sets a value) |
  | `{ start: '', end: '' }` | `date_range` `time_range` `datetime_range` |

  A `radio`, `segmented`, `choice` or `slider` always has a value (their `default` is required, or the slider's `min`).
- **Forms.** The record key `new` is reserved (it means "create"); a form's record routes accept POST, PUT and PATCH.
- **Capability.** A page's `capability` can only narrow the instance's: the menu entry, and so the screen, uses the instance one.
- **`upgraded`** fires inside `add_page()`: add your listener before you register the page.
- **Client config.** The object sent to the browser and the `fyldo/{slug}/config` filter that edits it are internal; their shape can change in any release.

## Coexistence and Strauss

- **Coexistence.** Any number of plugins may bundle Fyldo. The first copy loaded defines a tiny frozen `Loader`; every copy registers, and on `plugins_loaded` the **highest eligible `1.x`** wins and serves all consumers. So a plugin's bundled `1.0` may run on `1.4` from another plugin: inside a major, Fyldo follows strict semver. Options, REST routes, hooks, handles and DOM ids all derive from your slug, and one Fyldo screen per admin page keeps styles isolated both ways. A future `V2` lives beside `V1` with nothing shared.
- **Strauss (full isolation).** If you want no negotiation at all and a pinned version, re-prefix Fyldo into your own namespace with [Strauss](https://github.com/BrianHenryIE/strauss). Add `"extra": { "strauss": { "namespace_prefix": "Acme\\Vendor\\", "classmap_prefix": "Acme_Vendor_", "constant_prefix": "ACME_VENDOR_", "packages": [ "fyldo/fyldo" ], "delete_vendor_packages": true, "update_call_sites": false } }`, then `use Acme\Vendor\Fyldo\V1\Fyldo;`. A prefixed copy never negotiates with unprefixed ones, but its slug must still be unique on the site. The exact, tested configuration is in [docs/ARCHITECTURE.md §7](docs/ARCHITECTURE.md#7-strauss-optional-full-isolation--exact-configuration), and a working plugin that uses it is [examples/acme-example-strauss](examples/acme-example-strauss).

## Contributing

Only contributors need Node. See [CLAUDE.md](CLAUDE.md) for the test commands and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design.

```bash
npm ci && composer install
npm run release          # build/fyldo/ (drop-in) and build/fyldo.zip (plugin), prebuilt assets, no dev files
```

Releases: bump the version (`fyldo.php`, `package.json`), add a `CHANGELOG.md` entry, merge, then push a `vX.Y.Z` tag; the release workflow does the rest. Licence: GPL-2.0-or-later.

---

<div dir="rtl" lang="fa">

## فارسی

Fyldo یک چارچوب صفحهٔ تنظیمات برای توسعه‌دهندگان افزونه‌های وردپرس است. **صفحه‌ها ← بخش‌ها ← فیلدها** را در PHP تعریف می‌کنید؛ Fyldo رابط کاربری React (با پشتیبانی کامل از فارسی و راست‌به‌چپ) را می‌سازد و مقادیر را از طریق REST API پاک‌سازی، اعتبارسنجی و ذخیره می‌کند.

> **وضعیت: `1.0.0-beta.5`.** از نظر امکانات برای 1.0 کامل است، اما API هنوز قطعی نشده. به PHP 7.4+ و وردپرس 6.5+ نیاز دارد. در wordpress.org منتشر نشده است.

### نصب

سه راه برای بارگذاری یک پوشهٔ یکسان. کد استفاده از Fyldo در هر سه یکی است و فایل‌های ساخته‌شده همراه بسته هستند (نیازی به Node نیست).

1. **افزونهٔ مستقل:** فایل `fyldo.zip` را از صفحهٔ [Releases](https://github.com/SaeedCodez/fyldo/releases) دانلود کنید و از **افزونه‌ها ← افزودن ← بارگذاری افزونه** نصب و فعال کنید (یک داشبورد دمو در **تنظیمات ← دموی فیلدو** همه‌ی انواع فیلد را نشان می‌دهد. دمو به‌طور پیش‌فرض خاموش است؛ با یک خط روشنش کنید، مثلاً در یک mu-plugin: `add_filter( 'fyldo/fyldo-demo/enabled', '__return_true' );`. در حالت drop-in و Composer هرگز بارگذاری نمی‌شود و با حذف افزونهٔ فیلدو، جدول و گزینه‌هایش پاک می‌شوند). سپس در افزونهٔ خودتان `Fyldo::create()` را روی `init` فراخوانی کنید (مثال بالا). سرآیند `Requires Plugins: fyldo` فقط بررسی می‌کند که Fyldo فعال باشد.
2. **پوشهٔ drop-in:** `fyldo.zip` را داخل افزونهٔ خود باز کنید و بنویسید:
   ```php
   require_once __DIR__ . '/fyldo/fyldo.php';
   ```
3. **Composer:**
   ```bash
   composer require fyldo/fyldo
   ```
   تا وقتی Fyldo در Packagist نیست، مخزن را اضافه کنید: `composer config repositories.fyldo vcs https://github.com/SaeedCodez/fyldo`. سپس `require_once __DIR__ . '/vendor/autoload.php';`.

### مرجع پیکربندی (خلاصه)

- **فیلدها:** `text` `url` `email` `password` `number` `textarea` `toggle` `checkbox` `checkbox_group` `radio` `choice` `segmented` `slider` `color` `icon` `date` `time` `datetime` (تاریخ با تقویم شمسی یا میلادی؛ آنچه ذخیره می‌شود همیشه میلادی است: `Y-m-d`، `H:i` و تاریخ‌وزمان به وقت UTC)، `date_range` `time_range` `datetime_range` (بازهٔ شروع ← پایان با دو ورودی؛ مقدار ذخیره‌شده `array( 'start' => …, 'end' => … )` است؛ بازهٔ ساعت می‌تواند از نیمه‌شب بگذرد؛ `Dates::range_to_site()` و `Dates::time_in_range()` برای خواندن آن) `image` `file` `select` `multi_select`، `post` `term` `user` (جستجو و انتخاب یک یا چند نوشته، واژه یا کاربر سایت؛ مقدار ذخیره‌شده شناسه است)، `group` (فهرستی از آیتم‌ها با زیرفیلدهای یکسان؛ با `sortable` قابل جابه‌جایی و با `addable` قابل افزودن و حذف) و `notice` (فقط نمایشی). هر فیلد، notice، زیرفیلد group و هر بخش (section) می‌تواند `dependency` بگیرد، مثل Codestar: `'dependency' => [ 'cache', '==', true ]` یا فهرستی از شرط‌ها (همه باید برقرار باشند؛ با `'relation' => 'or'` یکی کافی است). نمایش و پنهان‌شدن زنده است و بدون ذخیره یا رفرش انجام می‌شود؛ فیلد پنهان نه اعتبارسنجی می‌شود و نه ذخیره، و مقدار ذخیره‌شده‌اش دست نمی‌خورد. عملگرها و جزئیات در بخش [Conditional fields](#conditional-fields). قواعد `validate` هم در PHP و هم در مرورگر اجرا می‌شوند؛ `validate_cb` و `sanitize_cb` فقط در PHP. فیلد `custom` هم دارید: کنترل را خودتان با React یا جاوااسکریپت ساده می‌سازید (`module` نشانی یک ES module است که React و چند کامپوننت خود فیلدو را می‌گیرد)؛ راهنما در [docs/custom-fields.md](docs/custom-fields.md).
- **صفحه‌ها و ناوبری:** `navigation` برابر `sidebar` (پیش‌فرض) یا `top`؛ گروه‌ها با `add_group`؛ زبانه‌ها با `tabs`؛ نشان عددی با `badge`.
- **تغییر مقدار پیش‌فرض:** فیلدی که کسی ذخیره‌اش نکرده، `default` را از کد می‌خواند؛ پس تغییر `default` در نسخهٔ جدید روی همهٔ این سایت‌ها اثر می‌گذارد. با `'default_before' => [ '2.0.0' => 10, '3.0.0' => 20 ]` (کلید: نسخه‌ای که پیش‌فرض جدید را آورد؛ مقدار: پیش‌فرض قبل از آن) Fyldo برای سایت‌های قدیمی همان مقدار قبلی را نگه می‌دارد. به `version` در نمونه نیاز دارد. جزئیات در [docs/default-history.md](docs/default-history.md).
- **صفحه‌ی سفارشی و فرم:** صفحه‌ای که تنظیمات نیست (فهرست رکوردها، ویرایشگر یک رکورد، داشبورد) را افزونه‌ی شما خودش می‌کشد، داخل صفحه‌ی فیلدو و با کامپوننت‌های آن: `add_page( $id, [ 'type' => 'custom', 'module' => … ] )`. با `add_form()` فیلدها را مثل یک صفحه تعریف می‌کنید و فیلدو اعتبارسنجی و نوار ذخیره را انجام می‌دهد، ولی ذخیره و خواندن رکورد با `load` و `save` خود شماست (مثلاً در جدول خودتان). اگر فیلدها را خود صفحه می‌کشد (فیلدهای وابسته به هم، پیش‌نمایش زنده)، `useForm` بارگذاری، اعتبارسنجی و ذخیره‌ی فیلدو را نگه می‌دارد و کشیدن فیلدها را به شما می‌سپارد. نمونه‌ی کامل: صفحه‌ی «اطلاعیه‌ها» در دموی فیلدو؛ راهنما در [docs/custom-pages.md](docs/custom-pages.md).
- **حذف افزونه:** Fyldo هیچ‌وقت داده‌ها را خودش پاک نمی‌کند. در `uninstall.php` نمونه و صفحه‌ها را مثل `init` ثبت کنید و `Fyldo::instance( 'acme-seo' )->delete_data()` را صدا بزنید؛ گزینهٔ همهٔ صفحه‌ها و `{slug}__fyldo` پاک می‌شوند.
- **حالت ذخیره:** `'save' => 'global'` (نوار ذخیره برای کل صفحه) یا `'section'` (دکمهٔ ذخیره در هر کارت)؛ یکی برای هر صفحه.
- **آیکون بیرون از فیلدو:** `Fyldo::icon( 'heart' )` کد `<svg>` یک آیکون Iconsax را برمی‌گرداند (به رنگ `currentColor`، بدون اسکریپت) تا سایت فقط آیکون‌هایی را که لازم دارد بگیرد، نه کل مجموعه را؛ `Fyldo::is_icon( $name )` نام آیکون را بررسی می‌کند. در صفحه‌ی سفارشی همین کد را `sdk.iconSvg( 'heart' )` در مرورگر می‌دهد.
- **لوگو و عنوان:** `title` نام برند است و `logo` نام یک آیکون Iconsax یا نشانی تصویر.
- **رنگ‌های افزونه (تم):** با `theme` صفحه‌ی فیلدو رنگ‌های خود افزونه را می‌گیرد: طیف `brand` (پله‌های `50` تا `950`؛ `600` رنگ دکمه‌ی اصلی، کلیدها و فوکوس است و `700` رنگ لینک‌ها) و طیف `neutral` (پس‌زمینه، حاشیه، متن و پرده‌ی پشت پنجره‌ها). هر پله‌ای را ندهید، رنگ خود فیلدو می‌ماند. همه‌ی فیلدها، کامپوننت‌ها و صفحه‌های سفارشی از تم پیروی می‌کنند؛ رنگ‌های وضعیت (خطا، هشدار، موفقیت، اطلاع) نه. پله‌ها همان متغیرهای مجموعه‌ی Theme در فایل فیگمای فیلدو هستند: هر پروژه یک mode برای خودش آنجا می‌سازد و مقدارهای آن را در PHP می‌دهد. راهنما در [docs/theming.md](docs/theming.md).
- **اعلان‌ها:** `$fyldo->admin_notice( $message, [ 'tone' => 'amber', 'page' => 'general' ] )` پیش از بارگذاری صفحه (`init` یا `admin_init`).
- **عملیات خطرناک:** بخشی با `'tone' => 'danger'` بدون فیلد و فقط با یک `action` (شناسهٔ `reset` برای بازگردانی پیش‌فرض‌ها). با `keyword` کاربر باید کلمه را تایپ کند؛ سرور نانس، سطح دسترسی و کلمه را بررسی می‌کند.

### هم‌زیستی و Strauss

هر تعداد افزونه می‌تواند نسخه‌ای از Fyldo را همراه خود داشته باشد؛ بالاترین نسخهٔ سازگار از `1.x` برنده می‌شود و برای همه اجرا می‌شود (در یک نسخهٔ اصلی، سمانتیک سخت‌گیرانه). گزینه‌ها، مسیرهای REST، هوک‌ها و شناسه‌های DOM همه از slug شما ساخته می‌شوند. برای جداسازی کامل و نسخهٔ قفل‌شده، Fyldo را با [Strauss](https://github.com/BrianHenryIE/strauss) به فضای‌نام خودتان ببرید (تنظیمات دقیق در [docs/ARCHITECTURE.md §7](docs/ARCHITECTURE.md#7-strauss-optional-full-isolation--exact-configuration)). نسخهٔ پیشوندی هرگز با نسخه‌های بدون پیشوند مذاکره نمی‌کند، ولی slug همچنان باید در سایت یکتا باشد.

</div>
