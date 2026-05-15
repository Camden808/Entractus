import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('<App />', () => {
  it('renders the home page at the index route', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /entractus recruitment/i }),
    ).toBeInTheDocument();
  });

  it('renders the persistent layout chrome', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
