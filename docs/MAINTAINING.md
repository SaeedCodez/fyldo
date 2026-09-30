# Maintaining Fyldo

How the whole project fits together, and step-by-step playbooks for the recurring jobs. Written for the owner and for
any new agent session. Deeper references: `docs/ARCHITECTURE.md` (design decisions), `design/figma/README.md` (design
pack details), `CLAUDE.md` (rules for agent sessions), `README.md` (how plugin developers use Fyldo).

## 1. The big picture

```
Figma file "Fyldo"  ──(export, local only)──▶  design/figma/ + tokens/   ──▶  code (src/, app/)
 source of truth                                committed snapshot              │
                                                     │                           ▼
                                                     └──────── tests compare ──▶ CI on every PR ──▶ merge ──▶ tag ──▶ Release
```

- **Figma is the source of truth** for the look: file `Pg3Ni7eqTLQYIG6hfNVPt6` ("Fyldo"). Ignore the "Fyldo - HeroUI" file.
- **The design pack is a committed snapshot of Figma.** Figma can only be read on the owner's Mac, so what the code and
  the tests need is exported once into the repo:
  - `tokens/figma.tokens.json`: colours, spacing, radii and type (Figma variables). `npm run tokens` turns it into CSS.
  - `design/figma/components/<name>.json`: every variant of every component (sizes, padding, token names, text styles).
  - `design/figma/png/`: an image of every variant (2x), plus the usage frames and page templates (1x).
  - `design/figma/brand/`: the Fyldo mark.
- **Tests compare the code with the pack.** Parity tests read the numbers from the JSON; pixel tests compare the
  rendered component with the PNG. CI has no Figma access, which is why the pack lives in the repo.
- **The pack never ships.** `.gitattributes` excludes `design/`, `tokens/`, tests and tooling from the ZIP and Composer package.

## 2. How reading Figma works (local Mac only)

```
Figma Desktop ⇄ Desktop Bridge plugin ⇄ figma-console MCP server ⇄ Claude
```

1. Open the Fyldo file in **Figma Desktop** and run the **Desktop Bridge** plugin (Plugins → Development).
2. The **figma-console MCP** server runs on the Mac and talks to that plugin. The official Figma MCP is blocked in Iran; use only figma-console.
3. Claude sends a script with `figma_execute`; it runs **inside Figma** and reads the file (the export scripts only read, never write).
4. `tools/figma/pack.mjs` turns the results into files in `design/figma/`.

Scripts: `tools/figma/export-pack.js` (components → JSON + PNG), `tools/figma/extract-variables.js` (tokens),
`tools/figma/extract-styles.js` (text and effect styles), `tools/figma/spot-check.mjs` (spec vs pack check).
Do **not** use `figma_export_tokens`: it can return a stale cache.

## 3. Where things live

| Path | What |
|---|---|
| `fyldo.php`, `src/` | PHP library (`Fyldo\V1`, PHP 7.4+): config API, fields, sanitize/validate, REST, admin screen |
| `app/` | React app (Base UI + Tailwind v4): components in `app/components/ui`, shell in `app/components/fyldo` |
| `demo/` | Demo dashboard, loaded only when Fyldo is installed as a plugin |
| `languages/` | `.pot`, Persian `fyldo-fa_IR.po` (+ generated `.mo`/`.json`) |
| `tests/php`, `tests/js`, `e2e/` | PHPUnit, Vitest, Playwright (`e2e/harness` = no WordPress, `e2e/wp` = real WordPress) |
| `tests/fixtures/validation-cases.json` | Shared validation cases, run by both PHPUnit and Vitest |
| `tools/` | Token generator, icon codegen, Figma export, release build |
| `.github/workflows/` | `ci.yml` (every PR/push), `release.yml` (on a `v*` tag) |

## 4. Playbooks

### A. Add a new component (or change an existing one)

1. **Design it in Figma** (by hand, or ask a local Claude session with figma-console). Rules the exporter and the code rely on:
   - A component set with a `Locale=EN|FA` variant axis; per-locale text props (`Label` + `Label (FA)`); FA variants mirror child order.
   - Colours, spacing and radii bound to existing variables, never raw values. Need a new token? See playbook B.
   - Icons: Iconsax, Linear variant. No blue focus ring (the code draws a neutral one).
   - Its own Section on the Components page, in the single horizontal row at y=0, containing "<Name> · Variants"
     and a "<Name> · Usage" frame (960 wide) that shows it in context.
2. **Export only that component** (local session, Figma open with Desktop Bridge running): follow
   `design/figma/README.md` → "Refreshing" with `--set "<Name>"`, then `node tools/figma/pack.mjs index && node tools/figma/pack.mjs verify`.
   Commit on a branch and open a PR.
3. **Implement it** (any session, Sonnet is enough). Prompt template:
   ```text
   Read CLAUDE.md first. Keep this session small: do only what is listed.
   Task: add <component names> from the design pack (design/figma/components/<name>.json and png/).
   - React component(s) built like the existing ones (tokens only, EN + FA/RTL, accessible).
   - <If it is a field type:> a PHP field class with sanitize/validate, plus shared fixture cases.
   - Tests per the test policy: one pixel test per component (EN + FA), Vitest for non-trivial behaviour.
   - Add it to the demo dashboard and to the README config reference.
   Open a PR, make CI green, report briefly and stop.
   ```
4. **Release** it with playbook C.

Heavy components (repeater, date picker, anything with complex keyboard behaviour) get their own session; 2–3 simple ones can share one.

### B. Change or add a design token

1. Change the variable in Figma (collections: Primitives, Color, Spacing, Typography; one mode only on the Starter plan; EN/FA are `en/` `fa/` prefixes).
2. Local session: follow `docs/figma-token-fixes.md` §3 (run `extract-variables.js` + `extract-styles.js`, save the raw files,
   `npm run tokens:snapshot`). **`git diff tokens/` must show only the change you intended**; check the variable count too.
3. `npm run tokens`, run the unit tests (the contrast test catches WCAG failures), open a PR.
4. If components visibly changed, re-export their PNGs (playbook A step 2).

### C. Release a new version

1. On a branch: set the version in `fyldo.php` (`Version:` header) and `package.json`, and move the `[Unreleased]` notes
   in `CHANGELOG.md` under `## [x.y.z] - YYYY-MM-DD`. Run `npm run i18n` if strings changed. Open a PR, wait for green CI, merge.
2. Tag the merged main:
   ```bash
   git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z
   ```
3. `release.yml` runs the full CI, builds `fyldo.zip`, moves the tag to a release commit that contains the built assets
   (for Composer; `main` never gets them) and creates the GitHub Release. A version with a `-` suffix (`-beta.3`) is marked pre-release.
4. Packagist picks up the tag automatically once the package is registered there (packagist.org → Submit → the GitHub repo URL).
   Not published on wordpress.org (decision O9).

Versioning (O8): semver. Before `1.0.0` the API may still change. From `1.0.0` on, breaking changes (renamed options, a
higher minimum PHP/WordPress) are only allowed in a new major, `Fyldo\V2`.

### D. Fix a bug or make a small change

Open a GitHub issue describing it, then give a session: "Read CLAUDE.md first. Fix issue #N. Open a PR, make CI green,
report briefly and stop." Collect several fixes, then release a new beta (playbook C).

### E. Move code-only designs into Figma

Some UI was built in code because Figma had no design for it. They are listed in `docs/design-spec.md` §10, §10.1 and §10.2
(password toggle, Multi Select "No results found.", derived M4 pieces, disabled helper colour). To bring Figma back in sync:
draw them in Figma, export the affected components (playbook A step 2), delete the item from the §10 list.

## 5. Working with agent sessions

- **Always start with:** "Read CLAUDE.md first." `CLAUDE.md` holds the test policy and the efficiency rules; this file holds the workflows.
- **Work goes through PRs.** A session works on a branch and opens a PR; CI must be green before you merge. Never commit to `main` directly.
- **Local vs cloud.** Local sessions (Claude Code on the Mac) can use Figma and use the Pro plan's quota. Cloud sessions
  (claude.ai/code) cannot use Figma and use their own credits; they build from the design pack. Give a local session this
  header: "This is a LOCAL session on my Mac: work on a new branch, open a PR with `gh`, don't run the WordPress
  Playwright project locally (CI runs it)."
- **Model.** Sonnet for components, fields, fixes and releases. Opus only for architectural work (new subsystems, data flow, routing).
- **Keep sessions small.** One milestone or one batch per session, with an explicit "out of scope" list and "report briefly and stop".
  Most of a session's time goes into running tests and waiting for CI, so local runs are limited to the changed parts (see CLAUDE.md).
- **Review.** Check a PR with `gh pr checks <N>`. A reviewing session only needs the PR number.

## 6. Environment notes and gotchas

- **Network (Iran):** Packagist, Docker Hub, the Playwright browser CDN and the official Figma MCP are blocked without a VPN.
  With a VPN everything works locally. Without one: Composer through a mirror via a scratch `COMPOSER_HOME`, WordPress via
  `npx wp-env start --runtime=playground`, Playwright via `PLAYWRIGHT_CHANNEL=chrome`.
- **Cloud sandbox:** PHPStan can't be installed (see CLAUDE.md); CI runs it.
- **Figma:** a `figma_execute` call that times out may still finish later, so check for duplicates before retrying. The
  Starter plan allows 3 pages and 1 variable mode. `figma_export_tokens` can serve stale data.
- **Composer autoload:** `fyldo.php` returns (not exits) when WordPress isn't loaded, so PHPUnit/PHPCS can load it.
