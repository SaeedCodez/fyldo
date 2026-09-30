# Fyldo

Settings-page framework for WordPress plugin developers: declare pages → sections → fields in PHP (7.4+, `Fyldo\V1`),
get a React 19 + Base UI + Tailwind v4 admin UI with REST-backed sanitize/validate/save. EN (LTR) + FA (RTL).

## Read first
- `docs/MAINTAINING.md`: how the project fits together and the playbooks (add a component, change a token, release)
- `docs/ARCHITECTURE.md` (§13 milestones, §15 decisions) · `docs/component-map.md` · `docs/design-spec.md`
- Design pack: `design/figma/README.md`, `design/figma/components/<name>.json` (geometry, token bindings, text styles),
  `design/figma/png/` (2x component PNGs, 1x usage frames), `tokens/figma.tokens.json` (do not regenerate).

## Design rule: no Figma, use `design/figma`
Never call Figma or any Figma MCP, unless the task is explicitly a Figma export or edit in a local session (see
`docs/MAINTAINING.md` §2 and §4). Figma is the source of truth, and its export is the pack above. Parity tests read
expected values from the JSON (`e2e/harness/support/pack.ts`), never hand-copied numbers. If a value you need is not in
the pack, stop and ask; do not guess. `node tools/figma/spot-check.mjs` must report 0 differences.

## Tests (run from the repo root)
- PHP unit: `composer install` then `composer test` (PHPUnit) · `composer lint` (phpcs) · `composer analyse` (phpstan 8)
- JS: `npm ci` · `npm run tokens:check` · `npm run typecheck` · `npm run lint` · `npm test` (Vitest) · `npm run i18n` (needs `wp` + `msgfmt`)
- Playwright harness (no WordPress): `npm run build && npm run build:gallery && npx playwright install --with-deps chromium`,
  then `npx playwright test --project=harness` (parity vs pack JSON, pixels vs pack PNGs at deviceScaleFactor 2)
- Playwright on WordPress: `npx tsx tools/fixtures/make-demos.ts && npx wp-env start` (`--runtime=playground` without Docker),
  then `npx playwright test --project=wp-setup --project=wp`
- Budgets: `npm run size`

## Conventions
- Shared validation fixture `tests/fixtures/validation-cases.json` runs in PHPUnit and Vitest: change rules on both sides.
- `tests/fixtures/*.client.json` are generated: `php tools/dev/dump-slice.php [form-fields]`.
- Tokens only (no hex, no arbitrary Tailwind values); logical CSS for RTL; Persian strings go in `languages/fyldo-fa_IR.po`.

## Test policy (from M2 part 3 on)
- Required: shared validation fixture cases for every new rule (PHPUnit + Vitest), PHPUnit for PHP logic, Vitest for
  non-trivial component behaviour (keyboard, ARIA). Typecheck, lint, phpcs, PHPStan as before.
- Visual: ONE pixel test per new component (default variant, EN + FA) against the pack PNG. No per-variant parity tests
  for new components; the existing parity suites stay as they are.
- WordPress e2e: add new fields to the existing save round-trip spec. No new spec files unless a milestone adds a new
  WordPress integration (routing, admin notices, and so on).
- Coexistence and isolation suites: untouched, run by CI only.

## Working efficiently (cloud sessions)
- CI is the full check. Locally, run only the tests for what you changed:
  `npx vitest run <file>`, `composer test -- --filter <Name>`, `npx playwright test --project=harness -g "<component>"`.
- Do not run the full Playwright suite or a "baseline" run. Run the WordPress project locally only when you changed
  PHP↔REST↔UI wiring, and then only the related spec.
- When a test fails, rerun only that test after the fix, not the whole suite.
- After pushing, check CI once after about 6 minutes; don't poll. Fix, push and wait again only if something failed.
- Composer in the cloud sandbox: GitHub zipball downloads are blocked, and PHPStan can't be installed. Remove the phpstan
  packages temporarily (`composer remove --dev --no-update phpstan/phpstan szepeviktor/phpstan-wordpress`), then
  `composer install`, and restore composer.json/composer.lock with git before committing. CI runs PHPStan.
