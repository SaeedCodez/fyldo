/**
 * Lower-case, hyphen-free lookup key. `setting-2`, `Setting2`, `SETTING2` and `setting2` are the same icon; the
 * package's digit-leading exports (`I3Dcube`) match their Iconsax names (`3d-cube`, `3dcube`).
 * (Shared by the runtime and by tools/icons/lib.ts — one definition.)
 */
export function normalizeIconName(name: string): string {
  return name
    .replace(/^I(?=\d)/, '')
    .replace(/[-_\s]/g, '')
    .toLowerCase();
}
