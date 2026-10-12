import { Component, type ErrorInfo, type ReactNode } from 'react';
import { __ } from '../../i18n';
import { Button } from '../ui/button';
import { Notice } from '../ui/notice';

/**
 * Last line of defence: a render crash anywhere in the app shows this instead of an empty screen. Saved settings are
 * untouched (nothing is sent), so reloading is always safe. A custom field's crash never gets here: it has its own
 * boundary in its row.
 */
export class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Fyldo: the settings screen crashed.', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div data-slot="fy-app-error" className="fy:p-8">
        <Notice
          tone="red"
          live
          title={__('These settings could not be shown', 'fyldo')}
          action={
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              {__('Reload page', 'fyldo')}
            </Button>
          }
        >
          {__('Something went wrong on this screen. Reload the page to try again; your saved settings are not affected.', 'fyldo')}
        </Notice>
      </div>
    );
  }
}
