# Changing a field's default safely (`default_before`)

Fyldo stores only what someone saved. A field nobody has touched has **no value in the database**: every read takes
its `default` from your code. That keeps defaults easy to fix, but it also means that changing a `default` in a new
release silently changes every site that never saved that field.

`default_before` prevents that. You write down, on the field, what the default used to be, and Fyldo keeps the old value
for the sites that had it. You don't need an activation hook or an upgrade routine.

## Usage

```php
Fyldo::create( 'my-blog', [
	'version' => MY_BLOG_VERSION,                            // required for default_before, e.g. '3.0.0'
] )->add_page( 'general', [
	'title'    => 'General',
	'sections' => [ [
		'id' => 'main', 'title' => 'Main',
		'fields' => [
			[
				'id'             => 'posts_per_page',
				'type'           => 'number',
				'label'          => 'Posts per page',
				'default'        => 30,                       // today's default (new sites get this)
				'default_before' => [ '2.0.0' => 10, '3.0.0' => 20 ], // "before 2.0.0 it was 10, before 3.0.0 it was 20"
			],
		],
	] ],
] );
```

Each time you change a default, add one entry: the key is the version that **introduces the new default**, and the
value is the default **before** it. Never remove entries, because a site may jump from any old version straight to the
latest one.

## What each site gets

With the field above, released as 1.0 (default 10), 2.0 (default 20) and 3.0 (default 30):

| Site | Before the update | After updating to 3.0 |
|---|---|---|
| Installed 1.0, never saved the field | 10 | **10** (Fyldo stores 10) |
| Installed 2.0, never saved the field | 20 | **20** (Fyldo stores 20) |
| Saved 15 at any time | 15 | **15** (never touched) |
| New install of 3.0 | — | **30** (nothing stored) |
| 1.0 → 2.0 → 3.0 step by step, never saved | 10 → 10 | **10** |

If you *want* every untouched site to get the new default (for example, the old one was a mistake), don't add an
entry for that version.

## How it works

1. **Fyldo remembers a version per page.** One autoloaded option per instance, `{slug}__fyldo`, holds
   `[ 'pages' => [ 'general' => '3.0.0', … ] ]`: the instance `version` each page last ran on this site.
2. **On `add_page()`** (every request, during `init`), Fyldo compares that stored version with the current `version`.
   When they match, which is almost always, nothing else happens: one autoloaded `get_option`, no query.
3. **When the version moved forward**, for every field of the page with **nothing stored**, Fyldo takes the default
   the field had in the version the site came from: the first `default_before` entry whose key is later than that
   version (compared with PHP's `version_compare()`). If that differs from today's default, Fyldo sanitizes and
   validates it and writes it to the page's option, alongside what is already stored. Then it records the new version
   and fires `fyldo/{slug}/upgraded`.
4. **The first time** Fyldo sees a page (a new install, or a page added in this release), there is nothing to compare
   with: it only records the version. Today's defaults apply.

Because this happens inside `add_page()`, the old defaults are in place before anything can read the page, whether
the first request after the update is the front end, wp-admin, REST or cron.

## Rules and edge cases

- **`version` is required.** A field with `default_before` on an instance without a valid `version` (`2.0.0`, `1.4`,
  `3.0.0-beta.1`) is a configuration error, and the page is skipped with `_doing_it_wrong`. An entry later than the
  current `version` is also an error.
- **Start tracking early.** Fyldo can only keep defaults for sites where it has already recorded a version, which
  happens on every request as soon as the instance has a `version`, even before any field uses `default_before`. Sites
  that update from a release without `version` (or without this Fyldo) are treated as new.
- **What someone saved always wins.** Fyldo only fills fields that have no stored value.
- **Only changes are written.** If the old default equals today's (a default changed and later changed back), or no
  longer validates (for example a removed `select` option), nothing is written.
- **Disabled fields** are kept too. They cannot be changed from the UI, but their default can still change between
  releases.
- **Not a save.** `before_save` and `saved` do not fire, because nothing a page reads changes. The page's revision
  does change, so a tab that was open across the update gets the usual "changed somewhere else" conflict on its next save.
- **Reset** (the Danger card or `Instance::reset()`) deletes the stored values: the page goes back to **today's**
  defaults, not the kept ones.
- **Downgrades** only record the lower version. The older code's own defaults apply. Updating again runs the history
  again from the lower version.
- **Multisite:** options are per site, so each site updates on its own next request.
- **Translated defaults:** a value such as `__( 'Read more', 'my-blog' )` is kept in the language of the request that
  ran the update. Prefer language-independent values in `default_before`.
- **Not allowed on:** `password` (it has no default), `notice` (it stores nothing) and sub-fields of a `group`. Put
  the earlier list of items on the group itself: `'default_before' => [ '2.0.0' => [ [ 'label' => 'Docs' ] ] ]`.
- **Uninstall:** `Instance::delete_data()` in your plugin's `uninstall.php` removes `{slug}__fyldo` along with the page options (see the README).

## Your own migrations: `fyldo/{slug}/upgraded`

The action fires once per page when its version moves forward, after the old defaults were kept:

```php
add_action( 'fyldo/my-blog/upgraded', static function ( string $page_id, string $from, string $to ) {
	if ( 'general' === $page_id && version_compare( $from, '3.0.0', '<' ) ) {
		// e.g. rename a field id, convert a stored format …
	}
}, 10, 3 );
```

## API

| Symbol | What |
|---|---|
| Field key `default_before` | `array<version, earlier default>`. Order doesn't matter; Fyldo sorts it oldest first. |
| `AbstractField::default_at( $version )` | The default the field had in `$version`. |
| `AbstractField::default_before()` | The history, oldest first. |
| `Storage\DefaultHistory` | The comparison and the write (`apply( Page )`), called by `Instance::add_page()`. |
| `Naming::state_option( $slug )` | `{slug}__fyldo`. |
| Action `fyldo/{slug}/upgraded` | `( $page_id, $from, $to )`. |
