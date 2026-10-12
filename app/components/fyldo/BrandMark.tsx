import type { ReactElement } from 'react';
import { _x, localizeDigits, sprintf } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { cn } from '../../lib/cn';
import { Badge } from '../ui/badge';
import type { Brand, BrandLogo } from './nav-model';

/**
 * The Fyldo mark: the 24×24 "Logo" frame of the pack's Brand (design/figma/brand/fyldo-mark-24.svg, one path), filled
 * with `currentColor` so it follows `text/primary`. Decorative: the brand name next to it says the same.
 */
export function FyldoMark({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      data-slot="fy-fyldo-mark"
      className="fy:shrink-0"
    >
      <path
        d="M5.32617 15.3782V8.69307H11.9796L5.32617 2H18.6727V8.71287H12.0192L18.6727 15.3663H12.0192V22L5.32617 15.3782Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The brand's 24px logo: the developer's Iconsax icon or image, else the Fyldo mark. Always decorative. */
function Logo({ logo, large }: { logo?: BrandLogo; large: boolean }): ReactElement {
  const side = large ? 36 : 24;
  if (logo && 'url' in logo) {
    // Empty alt: the name beside it already names the brand.
    return <img src={logo.url} alt="" width={side} height={side} data-slot="fy-brand-logo" className={cn('fy:shrink-0 fy:object-contain', large ? 'fy:size-9' : 'fy:size-6')} />;
  }
  if (logo && 'icon' in logo) {
    return large ? (
      <span className="fy:flex fy:size-9 fy:shrink-0 fy:items-center fy:justify-center">
        <Icon name={logo.icon} size={24} />
      </span>
    ) : (
      <Icon name={logo.icon} size={24} />
    );
  }
  return <FyldoMark size={side} />;
}

/**
 * Figma Top Navigation "Brand" (design/figma/brand/README.md): logo (24) · name (Heading/16) · version Badge, gap 10.
 * `large` is the Sidebar header: logo 36 · name Heading/20, gap 12 — no version (the Sidebar shows it in its footer).
 */
export function BrandMark({ brand, locale, large = false }: { brand: Brand; locale: string; large?: boolean }): ReactElement {
  return (
    <div data-slot="fy-brand" className={cn('fy:flex fy:min-w-0 fy:items-center fy:text-text-primary', large ? 'fy:w-full fy:gap-3' : 'fy:gap-2.5')}>
      <Logo logo={brand.logo} large={large} />
      <span data-slot="fy-brand-name" className={cn('fy:truncate fy:text-text-primary', large ? 'fy:min-w-0 fy:flex-1 fy:text-heading-20' : 'fy:text-heading-16')}>{brand.name}</span>
      {brand.version && !large ? (
        /* translators: %s: version number of the plugin, e.g. 1.0 */
        <Badge>
          {sprintf(_x('v%s', 'version badge', 'fyldo'), localizeDigits(brand.version, locale))}
        </Badge>
      ) : null}
    </div>
  );
}
