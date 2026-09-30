import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { TAB_OUTER, TabLook } from './Tab';

export interface TabsItem {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabsItem[];
  value: string;
  onValueChange: (id: string) => void;
  /** Names the tab list for screen readers (the page title). */
  label: string;
  locale?: string;
  /** Renders the panel of the active tab. */
  children: (id: string) => ReactNode;
  className?: string;
}

/*
 * Figma Tabs: a row of Tab instances, gap 4, over a 1px `border/default` divider along the bottom (the active tab's 2px
 * indicator covers it). Sub-pages of one nav item — never nested. A real WAI-ARIA tablist (Base UI Tabs): arrow keys
 * move focus (mirrored in RTL through DirectionProvider), Home/End jump, and Enter/Space ACTIVATE (manual activation:
 * a tab is a sub-page with its own URL, it is not opened just by passing over it).
 */
export function Tabs({
  tabs,
  value,
  onValueChange,
  label,
  locale,
  children,
  className,
}: TabsProps): ReactElement {
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(String(next))}
      data-slot="fy-tabs"
      className={className}
    >
      <BaseTabs.List
        activateOnFocus={false}
        aria-label={label}
        className="fy:relative fy:flex fy:gap-1 fy:wp-mobile:overflow-x-auto"
      >
        <span
          aria-hidden="true"
          className="fy:absolute fy:inset-x-0 fy:bottom-0 fy:h-px fy:bg-border-default"
        />
        {tabs.map((tab) => (
          <BaseTabs.Tab
            key={tab.id}
            value={tab.id}
            disabled={tab.disabled}
            data-slot="fy-tab"
            className={cn(TAB_OUTER, tab.disabled ? 'fy:cursor-not-allowed' : 'fy:cursor-pointer')}
          >
            <TabLook
              label={tab.label}
              icon={tab.icon}
              badge={tab.badge}
              active={tab.id === value}
              disabled={tab.disabled}
              locale={locale}
            />
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {/* Base UI mounts only the active panel. */}
      {tabs.map((tab) => (
        <BaseTabs.Panel key={tab.id} value={tab.id} data-slot="fy-tab-panel">
          {children(tab.id)}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
