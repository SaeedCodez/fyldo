import type { ReactElement, ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/** Figma "Page Header": Heading/32 + Copy/16, optional actions at the end. */
export function PageHeader({ title, description, actions }: PageHeaderProps): ReactElement {
  return (
    <header data-slot="fy-page-header" className="fy:flex fy:items-start fy:gap-6">
      <div className="fy:flex fy:min-w-0 fy:flex-1 fy:flex-col fy:gap-1.5">
        <h1 className="fy:text-heading-32 fy:text-text-primary">{title}</h1>
        {description ? <p className="fy:text-copy-16 fy:text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="fy:flex fy:shrink-0 fy:items-center fy:gap-2">{actions}</div> : null}
    </header>
  );
}
