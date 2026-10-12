# Fyldo

A settings-page framework for WordPress plugin developers. Declare **pages → sections → fields** in PHP; Fyldo renders a React admin UI (Vercel/Geist look, English + Persian/RTL) and sanitizes, validates and saves the values through the REST API.

> **Status: `1.0.0-beta.3`.** Feature-complete for 1.0, API not yet frozen. Requires PHP 7.4+ and WordPress 6.5+. Not published on wordpress.org. Version history: [CHANGELOG.md](CHANGELOG.md).

**Contents:** [Install](#install) · [Config reference](#config-reference) · [Coexistence and Strauss](#coexistence-and-strauss) · [Contributing](#contributing) · [فارسی](#فارسی)

## Install

One tree, three ways to load it. The code that uses Fyldo is the same in all three. Prebuilt assets are included everywhere: nobody needs Node.

### 1. Standalone plugin (ZIP)

Download `fyldo.zip` from the [GitHub Releases](https://github.com/SaeedCodez/fyldo/releases) page and install it from **Plugins → Add New → Upload Plugin**. Activate it, then use the API from your own plugin (a demo dashboard under **Settings → Fyldo demo** shows every field type; turn it off with the `fyldo/fyldo-demo/enabled` filter, and it never loads in drop-in or Composer mode):

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

### 3. Composer

```bash
composer require fyldo/fyldo
```

Until Fyldo is on Packagist, add the repository first: `composer config repositories.fyldo vcs https://github.com/SaeedCodez/fyldo`. Release tags carry the prebuilt assets (`main` does not).

```php
require_once __DIR__ . '/vendor/autoload.php';   // Composer only loads fyldo.php; there is no PSR-4 map on purpose
// then the same Fyldo::create() code as above, on `init`
```

## Config reference

Create instances on `init` (by then the winning copy is chosen). Values are stored per page in the option `{slug}_{page}` (autoload off) and read with `Fyldo::instance( 'acme-seo' )->get( 'general', 'site_title' )`, `->all( 'general' )` and `->update( 'general', [ … ] )`.

```php
$fyldo = Fyldo::create( 'acme-seo', [                // slug: a-z, 0-9, "-", 3–40 characters, unique per site
	'title'      => 'Acme SEO',                       // brand name (default "Fyldo")
	'logo'       => 'chart-2',                        // an Iconsax name or an image URL (default: the Fyldo mark)
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

Every field takes `id`, `type`, `label`, `description`, `default`, `default_before`, `disabled` (`true` or a reason string), `icon`, `layout`, `validate`, `sanitize_cb` and `validate_cb`.

`layout` sets where the control sits in its row: `inline` (at the end, for on/off controls), `stacked` (under the description) or `field` (an input at the end of the row, error under it; stacked on narrow screens). The default is `field` for every type except `choice` (`stacked`, its cards are too wide to sit beside the label) and `toggle`/`checkbox` (`inline`). Set it only to override.

| `type` | Notes |
|---|---|
| `text` `url` `email` | `placeholder`. `url` accepts `validate.schemes`. |
| `password` | Write-only: never sent to the browser. No `default`. |
| `number` | `min` `max` `step` in `validate`. Persian and Arabic-Indic digits are read as ASCII. |
| `textarea` | `rows`. With `validate.max_length` it shows a live counter. |
| `toggle` `checkbox` | A boolean. |
| `checkbox_group` `radio` `select` `multi_select` | `options`: `[ 'value' => 'Label' ]`, a list of `[ 'value', 'label', 'disabled' ]`, or a callable. `radio` needs a `default`. `select` and `multi_select` take `searchable`. |
| `choice` | A Choice Card Group: exactly one of a few selectable cards (single choice, like `radio`). `options` as for `radio`, plus per option `description` and `image` (an `http(s)` URL or a path starting with `/`); every option needs a `label`, which names the card even when only the image shows. `content`: `auto` (default: every option has an `image` → image and text, none has → text only, a mix is a configuration error), `image` (images only, every option needs one) or `text` (ignores images). `columns`: `2` (default), `3` or `4`; up to 782px wide at most 2, up to 480px one. Nothing selected is an error (`required`), so a `default` is optional; if given it must be an enabled option. |
| `segmented` | A Segmented Control: exactly one of 2–5 short `options` (same forms as `radio`, without descriptions). Needs a `default` that is an enabled option. |
| `slider` | A number in a bounded range, picked with a single thumb. `min` (default `0`), `max` (`100`) and `step` (`1`) are set on the field; they are exported as the `min` / `max` / `step` rules, so a value outside the range or off the step is rejected in PHP and in the browser (nothing is clamped silently). `default` is `min` unless given. |
| `color` | One free colour: a swatch and its hex value that open a picker (saturation/brightness area, hue strip, hex box, presets). Stored as lower-case `#rrggbb`, no alpha; typed text such as `#ABC` or `2271b1` is read as `#aabbcc` / `#2271b1`. `default` is a hex colour (none by default); `presets` is a list of hex colours (default: the 16 of the design) or `false` to hide the section; a non-hex preset is a configuration error. Empty is allowed unless `validate.required`. |
| `icon` | One icon from the Iconsax Linear library: a preview tile and the icon's name that open a modal with a search box and a scrolling icon grid. Stored as the kebab-case name, e.g. `setting-2` (the same names as the `icon` option). `default` is an icon name (none by default). `icons` is an optional list of names that restricts both the picker and the server-side check; the server never holds the full list, so a well-formed name it has no list for is accepted (the browser then draws nothing). Layout default `field`; `validate.required` is supported. |
| `image` | One image from the WordPress media library: a thumbnail, the file name with its dimensions and size, and **Select image** / **Replace** and a remove button. The field only opens WordPress's own media modal (`wp.media`); Fyldo has no uploader, and the buttons stay inert where `wp.media` is not loaded. **The stored value is the attachment ID** (an integer, `0` = none): the name, size and dimensions are read from the attachment, never from a URL, and removing only clears the value; it never deletes the file from the media library. Read it with `wp_get_attachment_image_url( (int) $value, 'full' )` (or `wp_get_attachment_image( (int) $value, 'medium' )`). `types` (optional) narrows the accepted extensions to image ones, e.g. `[ 'png', 'webp' ]` or the `'image'` group (mapped to MIME types with `wp_get_mime_types()`; an unknown extension throws a `ConfigException`; default: every image type). `max_size` (optional) is a number of bytes or text such as `'2MB'` (an invalid value throws a `ConfigException`). A picked file of the wrong type or over the size shows the field's error and the value does not change; the server checks again on save (the attachment must exist and be readable by the current user, be an image, be one of `types` and not exceed `max_size`). Layout default `field`; `validate.required` means "an attachment is chosen". |
| `file` | One file from the WordPress media library (a PDF, an archive, an Office document, any type you allow): a file tile, the file name with its type and size, and **Select file** / **Replace** and a remove button. Same behaviour and checks as `image`; **the stored value is the attachment ID** (`0` = none). Read it with `wp_get_attachment_url( (int) $value )` (or `get_attached_file( (int) $value )` for the path). `types` (optional) takes extensions or WordPress type groups such as `'image'` and `'document'` (`image`, `audio`, `video`, `document`, `spreadsheet`, `interactive`, `text`, `archive`, `code`, from `wp_get_ext_types()`), e.g. `[ 'document', 'archive', 'image' ]` or `[ 'pdf', 'zip' ]`; it limits both the media modal and the server check. Without `types` the field accepts every type WordPress allows, images included. `max_size` as for `image`. |
| `group` | A list of items that share the same sub-fields, e.g. header buttons with a label, an icon and a link. `fields` is a list of ordinary field configs (any type except `group`, `image`, `file`, `password` and `notice`; sub-field ids are unique inside the group). **The stored value is a list of arrays keyed by sub-field id**, in the order shown, e.g. `[ [ 'label' => 'Docs', 'icon' => 'book', 'link' => 'https://…' ], … ]`. `addable` (default `false`): Add (a new item at the end, opened), Duplicate and Remove (at once, with Undo in a toast). Without it the group is **fixed**: it always holds exactly the items of `default`, which is then required. `sortable` (default `false`): a drag handle per item; with the keyboard, Space picks an item up, the arrow keys move it, Space drops it and Escape puts it back. `min` / `max` (only with `addable`) limit the number of items; the count next to Add shows the limit. `item_title` names an item after one of its sub-fields (otherwise "Item 1", "Item 2"…), `item_icon` shows an `icon` sub-field as the item's preview tile, `add_label` is the Add button's text. Each sub-field validates as on its own; its error is keyed `<group>.<index>.<sub-field>` in the REST 422 and the `validate/<page>` filter, and a failed save opens the first item with an error. `validate.required` (at least one item) is the only rule of the group itself; `validate_cb` receives the whole list once every item is valid. A stored sub-field value that no longer validates reads as that sub-field's `default`. |
| `custom` | A control you draw yourself, in React or plain JavaScript: `module` is the URL of an ES module whose default export receives Fyldo's React and a few of its components (`ui.Select`, `ui.Input`…) and returns a `Component` (or a `mount` function), plus an optional `validate`. `props` (an array keyed by name) reaches the module as-is: put translated labels there. `style` is a stylesheet to enqueue with the screen. The value is any JSON value, its text cleaned like a textarea's; `validate_cb` is the check that counts. Works inside a `group`. See [docs/custom-fields.md](docs/custom-fields.md) and the demo's "Opening hours" page (two selects saved as one value). |
| `notice` | Display only, never stored: `description`, `tone` (`gray` `blue` `green` `amber` `red`). |

`validate` keys: `required`, `min_length`, `max_length`, `pattern`, `min`, `max`, `step`, `schemes`, `allowed`. They run in PHP **and** in the browser. `validate_cb( $value )` (return `true`, `false` or a message) and `sanitize_cb` are PHP-only; the server is authoritative.

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

### Uninstall

Fyldo never deletes your data. In your plugin's `uninstall.php`, load Fyldo, register your instance and pages the same way as on `init` (keep that code in a function you can call), then call `delete_data()`. It deletes every registered page's option and Fyldo's own `{slug}__fyldo`, and fires no hooks.

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

`fyldo/{slug}/before_save`, `fyldo/{slug}/saved` and `fyldo/{slug}/reset` (actions, `$page_id, $new, $old`), `fyldo/{slug}/upgraded` (`$page_id, $from, $to`, once per page when the instance `version` moves forward), and the filters `fyldo/{slug}/sanitize/{page}` and `fyldo/{slug}/validate/{page}`.

## Coexistence and Strauss

- **Coexistence.** Any number of plugins may bundle Fyldo. The first copy loaded defines a tiny frozen `Loader`; every copy registers, and on `plugins_loaded` the **highest eligible `1.x`** wins and serves all consumers. So a plugin's bundled `1.0` may run on `1.4` from another plugin: inside a major, Fyldo follows strict semver. Options, REST routes, hooks, handles and DOM ids all derive from your slug, and one Fyldo screen per admin page keeps styles isolated both ways. A future `V2` lives beside `V1` with nothing shared.
- **Strauss (full isolation).** If you want no negotiation at all and a pinned version, re-prefix Fyldo into your own namespace with [Strauss](https://github.com/BrianHenryIE/strauss). Add `"extra": { "strauss": { "namespace_prefix": "Acme\\Vendor\\", "classmap_prefix": "Acme_Vendor_", "constant_prefix": "ACME_VENDOR_", "packages": [ "fyldo/fyldo" ], "delete_vendor_packages": true, "update_call_sites": false } }`, then `use Acme\Vendor\Fyldo\V1\Fyldo;`. A prefixed copy never negotiates with unprefixed ones, but its slug must still be unique on the site. The exact, tested configuration is in [docs/ARCHITECTURE.md §7](docs/ARCHITECTURE.md#7-strauss-optional-full-isolation--exact-configuration).

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

> **وضعیت: `1.0.0-beta.3`.** از نظر امکانات برای 1.0 کامل است، اما API هنوز قطعی نشده. به PHP 7.4+ و وردپرس 6.5+ نیاز دارد. در wordpress.org منتشر نشده است.

### نصب

سه راه برای بارگذاری یک پوشهٔ یکسان. کد استفاده از Fyldo در هر سه یکی است و فایل‌های ساخته‌شده همراه بسته هستند (نیازی به Node نیست).

1. **افزونهٔ مستقل:** فایل `fyldo.zip` را از صفحهٔ [Releases](https://github.com/SaeedCodez/fyldo/releases) دانلود کنید و از **افزونه‌ها ← افزودن ← بارگذاری افزونه** نصب و فعال کنید (یک داشبورد دمو در **تنظیمات ← دموی فیلدو** همه‌ی انواع فیلد را نشان می‌دهد؛ با فیلتر `fyldo/fyldo-demo/enabled` خاموش می‌شود و در حالت drop-in و Composer هرگز بارگذاری نمی‌شود). سپس در افزونهٔ خودتان `Fyldo::create()` را روی `init` فراخوانی کنید (مثال بالا). سرآیند `Requires Plugins: fyldo` فقط بررسی می‌کند که Fyldo فعال باشد.
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

- **فیلدها:** `text` `url` `email` `password` `number` `textarea` `toggle` `checkbox` `checkbox_group` `radio` `choice` `segmented` `slider` `color` `icon` `image` `file` `select` `multi_select`، `group` (فهرستی از آیتم‌ها با زیرفیلدهای یکسان؛ با `sortable` قابل جابه‌جایی و با `addable` قابل افزودن و حذف) و `notice` (فقط نمایشی). قواعد `validate` هم در PHP و هم در مرورگر اجرا می‌شوند؛ `validate_cb` و `sanitize_cb` فقط در PHP. فیلد `custom` هم دارید: کنترل را خودتان با React یا جاوااسکریپت ساده می‌سازید (`module` نشانی یک ES module است که React و چند کامپوننت خود فیلدو را می‌گیرد)؛ راهنما در [docs/custom-fields.md](docs/custom-fields.md).
- **صفحه‌ها و ناوبری:** `navigation` برابر `sidebar` (پیش‌فرض) یا `top`؛ گروه‌ها با `add_group`؛ زبانه‌ها با `tabs`؛ نشان عددی با `badge`.
- **تغییر مقدار پیش‌فرض:** فیلدی که کسی ذخیره‌اش نکرده، `default` را از کد می‌خواند؛ پس تغییر `default` در نسخهٔ جدید روی همهٔ این سایت‌ها اثر می‌گذارد. با `'default_before' => [ '2.0.0' => 10, '3.0.0' => 20 ]` (کلید: نسخه‌ای که پیش‌فرض جدید را آورد؛ مقدار: پیش‌فرض قبل از آن) Fyldo برای سایت‌های قدیمی همان مقدار قبلی را نگه می‌دارد. به `version` در نمونه نیاز دارد. جزئیات در [docs/default-history.md](docs/default-history.md).
- **حذف افزونه:** Fyldo هیچ‌وقت داده‌ها را خودش پاک نمی‌کند. در `uninstall.php` نمونه و صفحه‌ها را مثل `init` ثبت کنید و `Fyldo::instance( 'acme-seo' )->delete_data()` را صدا بزنید؛ گزینهٔ همهٔ صفحه‌ها و `{slug}__fyldo` پاک می‌شوند.
- **حالت ذخیره:** `'save' => 'global'` (نوار ذخیره برای کل صفحه) یا `'section'` (دکمهٔ ذخیره در هر کارت)؛ یکی برای هر صفحه.
- **لوگو و عنوان:** `title` نام برند است و `logo` نام یک آیکون Iconsax یا نشانی تصویر.
- **اعلان‌ها:** `$fyldo->admin_notice( $message, [ 'tone' => 'amber', 'page' => 'general' ] )` پیش از بارگذاری صفحه (`init` یا `admin_init`).
- **عملیات خطرناک:** بخشی با `'tone' => 'danger'` بدون فیلد و فقط با یک `action` (شناسهٔ `reset` برای بازگردانی پیش‌فرض‌ها). با `keyword` کاربر باید کلمه را تایپ کند؛ سرور نانس، سطح دسترسی و کلمه را بررسی می‌کند.

### هم‌زیستی و Strauss

هر تعداد افزونه می‌تواند نسخه‌ای از Fyldo را همراه خود داشته باشد؛ بالاترین نسخهٔ سازگار از `1.x` برنده می‌شود و برای همه اجرا می‌شود (در یک نسخهٔ اصلی، سمانتیک سخت‌گیرانه). گزینه‌ها، مسیرهای REST، هوک‌ها و شناسه‌های DOM همه از slug شما ساخته می‌شوند. برای جداسازی کامل و نسخهٔ قفل‌شده، Fyldo را با [Strauss](https://github.com/BrianHenryIE/strauss) به فضای‌نام خودتان ببرید (تنظیمات دقیق در [docs/ARCHITECTURE.md §7](docs/ARCHITECTURE.md#7-strauss-optional-full-isolation--exact-configuration)). نسخهٔ پیشوندی هرگز با نسخه‌های بدون پیشوند مذاکره نمی‌کند، ولی slug همچنان باید در سایت یکتا باشد.

</div>
