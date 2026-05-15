import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import Input from './Input';

describe('<Input />', () => {
  it('associates the label with the input via htmlFor/id', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('renders helper text and links it via aria-describedby', () => {
    render(<Input label="Email" helperText="We never share it." />);
    const input = screen.getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(/never share/i);
  });

  it('shows error text and sets aria-invalid when error is provided', () => {
    render(<Input label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)).toHaveTextContent('Required');
  });

  it('passes value/onChange through and is controllable', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Input label="Email" value="" onChange={onChange} />);
    await user.type(screen.getByLabelText('Email'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('forwards type, placeholder, and other input props', () => {
    render(<Input label="Phone" type="tel" placeholder="555-..." />);
    const input = screen.getByLabelText('Phone');
    expect(input).toHaveAttribute('type', 'tel');
    expect(input).toHaveAttribute('placeholder', '555-...');
  });
});
