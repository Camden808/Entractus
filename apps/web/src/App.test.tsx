import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('<App />', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('shows the Entractus Recruitment heading', () => {
    render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /entractus recruitment/i }),
    ).toBeInTheDocument();
  });

  it('shows the scaffold subtitle', () => {
    render(<App />);
    expect(screen.getByText(/web app scaffold ready/i)).toBeInTheDocument();
  });
});
