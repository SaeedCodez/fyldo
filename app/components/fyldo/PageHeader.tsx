import type { ReactElement, ReactNode, Ref } from 'react';
import { __ } from '../../i18n';
import { ButtonLink } from '../ui/button';
import type { UtilityLink } from './nav-model';

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Links drawn as the Figma "Actions": Secondary Small buttons, a trailing `export-square` icon on links that open a new tab. */
  links?: UtilityLink[];
  actions?: ReactNode;
  /** The h1 receives focus after a page change, so screen readers hear where they are. */
  headingRef?: Ref<HTMLHeadingElement>;
}

/** Figma "Page Header": Heading/32 + Copy/16 (gap 6), actions at the end (gap 24; between actions 8). */
export function PageHeader({
  title,
  description,
  links = [],
  actions,
  headingRef,
}: PageHeaderProps): ReactElement {
  const hasActions = links.length > 0 || Boolean(actions);
  return (
    <header data-slot="fy-page-header" className="fy:flex fy:items-start fy:gap-6">
      <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-1.5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="fy:text-heading-32 fy:text-text-primary fy:outline-none"
        >
          {title}
        </h1>
        {description ? (
          <p className="fy:text-copy-16 fy:text-text-secondary">{description}</p>
        ) : null}
      </div>
      {hasActions ? (
        <div
          data-slot="fy-page-header-actions"
          className="fy:flex fy:shrink-0 fy:items-center fy:gap-2"
        >
          {links.map((link) => (
            <ButtonLink
              key={link.href}
              href={link.href}
              target={link.external ? '_blank' : undefined}
              rel={link.external ? 'noopener noreferrer' : undefined}
              variant="secondary"
              size="sm"
              leadingIcon={link.icon && !link.external ? link.icon : undefined}
              trailingIcon={link.external ? 'export-square' : undefined}
            >
              {link.label}
              {link.external ? (
                <>
                  {' '}
                  <span className="fy:sr-only">{__('(opens in a new tab)', 'fyldo')}</span>
                </>
              ) : null}
            </ButtonLink>
          ))}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
