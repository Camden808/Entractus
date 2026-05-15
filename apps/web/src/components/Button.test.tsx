import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import Button from './Button';

describe('<Button />', () => {
  it('defaults to type=button so it does not submit a wrapping form', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toHaveAttribute('type', 'button');
  });

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: /go/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables the button while loading and exposes aria-busy', () => {
    render(<Button isLoading>Saving</Button>);
    const button = screen.getByRole('button', { name: /saving/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('honors disabled prop', () => {
    render(<Button disabled>Off</Button>);
    expect(screen.getByRole('button', { name: /off/i })).toBeDisabled();
  });

  it('forwards additional props such as data-testid and aria-label', () => {
    render(
      <Button data-testid="cta" aria-label="primary cta">
        x
      </Button>,
    );
    const button = screen.getByTestId('cta');
    expect(button).toHaveAttribute('aria-label', 'primary cta');
  });
});
