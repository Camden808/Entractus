import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import Textarea from './Textarea';

describe('<Textarea />', () => {
  it('associates the label with the textarea', () => {
    render(<Textarea label="Duties" />);
    expect(screen.getByLabelText('Duties').tagName).toBe('TEXTAREA');
  });

  it('defaults to rows=4 and respects an override', () => {
    const { rerender } = render(<Textarea label="Notes" />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '4');
    rerender(<Textarea label="Notes" rows={6} />);
    expect(screen.getByLabelText('Notes')).toHaveAttribute('rows', '6');
  });

  it('renders helper text via aria-describedby', () => {
    render(<Textarea label="Notes" helperText="Optional context." />);
    const ta = screen.getByLabelText('Notes');
    const describedBy = ta.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)).toHaveTextContent(/optional context/i);
  });

  it('shows error text and sets aria-invalid', () => {
    render(<Textarea label="Notes" error="Required" />);
    const ta = screen.getByLabelText('Notes');
    expect(ta).toHaveAttribute('aria-invalid', 'true');
    const describedBy = ta.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)).toHaveTextContent('Required');
  });

  it('fires onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Textarea label="Notes" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText('Notes'), 'x');
    expect(onChange).toHaveBeenCalled();
  });
});
