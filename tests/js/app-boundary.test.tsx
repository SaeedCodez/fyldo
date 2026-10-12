import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppBoundary } from '../../app/components/fyldo/AppBoundary';

function Broken(): never {
  throw new Error('boom');
}

describe('App boundary', () => {
  it('shows its children while nothing crashes', () => {
    render(
      <AppBoundary>
        <p>Settings</p>
      </AppBoundary>,
    );
    expect(screen.getByText('Settings')).toBeVisible();
  });

  it('replaces a crashed screen with an error notice and a way to reload, instead of an empty page', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <AppBoundary>
        <Broken />
      </AppBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('These settings could not be shown');
    expect(alert).toHaveTextContent('your saved settings are not affected');
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeEnabled();
    expect(logged).toHaveBeenCalledWith('Fyldo: the settings screen crashed.', expect.any(Error), expect.any(String));
    logged.mockRestore();
  });
});
