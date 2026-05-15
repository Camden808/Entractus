import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import Select from './Select';

const OPTIONS = [
  { value: 'temp', label: 'Temporary' },
  { value: 'temp-perm', label: 'Temp To Perm' },
  { value: 'direct', label: 'Direct Hire' },
] as const;

describe('<Select />', () => {
  it('renders the label and links it to the select', () => {
    render(<Select label="Position Type" options={OPTIONS} />);
    const select = screen.getByLabelText('Position Type');
    expect(select.tagName).toBe('SELECT');
  });

  it('renders every option', () => {
    render(<Select label="Position Type" options={OPTIONS} />);
    expect(screen.getByRole('option', { name: 'Temporary' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Temp To Perm' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Direct Hire' })).toBeInTheDocument();
  });

  it('shows a disabled placeholder when one is provided', () => {
    render(
      <Select label="Position Type" options={OPTIONS} placeholder="Pick one" defaultValue="" />,
    );
    const placeholder = screen.getByRole('option', { name: 'Pick one' });
    expect(placeholder).toHaveAttribute('disabled');
  });

  it('fires onChange when a different option is selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select label="Position Type" options={OPTIONS} defaultValue="temp" onChange={onChange} />,
    );
    await user.selectOptions(screen.getByLabelText('Position Type'), 'direct');
    expect(onChange).toHaveBeenCalled();
  });

  it('renders error text and sets aria-invalid', () => {
    render(<Select label="Position Type" options={OPTIONS} error="Required" />);
    const select = screen.getByLabelText('Position Type');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    const describedBy = select.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)).toHaveTextContent('Required');
  });
});
