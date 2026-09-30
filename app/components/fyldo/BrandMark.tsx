import type { ReactElement } from 'react';
import { _x, localizeDigits, sprintf } from '../../i18n';
import { Badge } from '../ui/badge';
import type { Brand } from './nav-model';

/**
 * Figma Sidebar/Top Navigation "Brand": name (Heading/16) + version Badge, gap 10. The pack's 24px logo is the Fyldo
 * mark, drawn as a vector whose geometry is not in the reference pack, and the PHP API has no logo for the consuming
 * plugin — so no logo is drawn (see docs/component-map.md §4.1).
 */
export function BrandMark({ brand, locale }: { brand: Brand; locale: string }): ReactElement {
  return (
    <div data-slot="fy-brand" className="fy:flex fy:min-w-0 fy:items-center fy:gap-2.5">
      <span className="fy:truncate fy:text-heading-16 fy:text-text-primary">{brand.name}</span>
      {brand.version ? (
        /* translators: %s: version number of the plugin, e.g. 1.0 */
        <Badge>
          {sprintf(_x('v%s', 'version badge', 'fyldo'), localizeDigits(brand.version, locale))}
        </Badge>
      ) : null}
    </div>
  );
}
