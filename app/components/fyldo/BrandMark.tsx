import type { ReactElement } from 'react';
import { _x, localizeDigits, sprintf } from '../../i18n';
import { Icon } from '../../icons/Icon';
import { Badge } from '../ui/badge';
import type { Brand, BrandLogo } from './nav-model';

/**
 * The Fyldo mark: the 24×24 "Logo" frame of the pack's Brand (design/figma/brand/fyldo-mark-24.svg, one path), filled
 * with `currentColor` so it follows `text/primary`. Decorative: the brand name next to it says the same.
 */
export function FyldoMark(): ReactElement {
  return (
    <svg
      width={24}
      height={24}
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
function Logo({ logo }: { logo?: BrandLogo }): ReactElement {
  if (logo && 'url' in logo) {
    // Empty alt: the name beside it already names the brand.
    return <img src={logo.url} alt="" width={24} height={24} data-slot="fy-brand-logo" className="fy:size-6 fy:shrink-0 fy:object-contain" />;
  }
  if (logo && 'icon' in logo) return <Icon name={logo.icon} size={24} />;
  return <FyldoMark />;
}

/**
 * Figma Sidebar/Top Navigation "Brand" (design/figma/brand/README.md): logo (24) · name (Heading/16) · version Badge,
 * gap 10.
 */
export function BrandMark({ brand, locale }: { brand: Brand; locale: string }): ReactElement {
  return (
    <div data-slot="fy-brand" className="fy:flex fy:min-w-0 fy:items-center fy:gap-2.5 fy:text-text-primary">
      <Logo logo={brand.logo} />
      <span data-slot="fy-brand-name" className="fy:truncate fy:text-heading-16 fy:text-text-primary">{brand.name}</span>
      {brand.version ? (
        /* translators: %s: version number of the plugin, e.g. 1.0 */
        <Badge>
          {sprintf(_x('v%s', 'version badge', 'fyldo'), localizeDigits(brand.version, locale))}
        </Badge>
      ) : null}
    </div>
  );
}
