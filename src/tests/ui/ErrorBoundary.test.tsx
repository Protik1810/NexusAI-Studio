import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../../components/ErrorBoundary';

function Bomb(): never {
  throw new Error('kaboom from a child component');
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>everything is fine</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('everything is fine')).toBeInTheDocument();
  });

  it('catches a render error and shows the fallback instead of unmounting the app', () => {
    // React logs the caught error to the console by default; keep the test
    // output clean since we're deliberately triggering one.
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('kaboom from a child component')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload solframe studio/i })).toBeInTheDocument();
  });
});
