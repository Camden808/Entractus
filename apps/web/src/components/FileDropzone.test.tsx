import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import FileDropzone from './FileDropzone';

function makeFile(name = 'jd.pdf', type = 'application/pdf', body = 'fake') {
  return new File([body], name, { type });
}

describe('<FileDropzone />', () => {
  it('renders the label and links it to the file input', () => {
    render(<FileDropzone label="Job description" onChange={() => {}} />);
    const input = screen.getByLabelText('Job description');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'file');
  });

  it('emits the picked file via onChange', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FileDropzone label="Job description" onChange={onChange} />);
    const file = makeFile();
    await user.upload(screen.getByLabelText('Job description'), file);
    expect(onChange).toHaveBeenCalledOnce();
    const emitted = onChange.mock.calls[0]![0] as File[];
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.name).toBe('jd.pdf');
  });

  it('keeps only the first file when multiple is false', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FileDropzone label="Job description" onChange={onChange} />);
    await user.upload(screen.getByLabelText('Job description'), [
      makeFile('a.pdf'),
      makeFile('b.pdf'),
    ]);
    const emitted = onChange.mock.calls[0]![0] as File[];
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.name).toBe('a.pdf');
  });

  it('keeps every file when multiple is true', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FileDropzone label="Job description" multiple onChange={onChange} />);
    await user.upload(screen.getByLabelText('Job description'), [
      makeFile('a.pdf'),
      makeFile('b.pdf'),
    ]);
    const emitted = onChange.mock.calls[0]![0] as File[];
    expect(emitted.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('renders the chosen file name and a Remove control', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const file = makeFile('jd.pdf');
    render(<FileDropzone label="Job description" value={[file]} onChange={onChange} />);
    expect(screen.getByText(/jd\.pdf/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('forwards accept and multiple attributes', () => {
    render(
      <FileDropzone
        label="Job description"
        accept=".pdf,.doc,.docx"
        multiple
        onChange={() => {}}
      />,
    );
    const input = screen.getByLabelText('Job description');
    expect(input).toHaveAttribute('accept', '.pdf,.doc,.docx');
    expect(input).toHaveAttribute('multiple');
  });

  it('shows error and sets aria-invalid', () => {
    render(<FileDropzone label="Job description" onChange={() => {}} error="Required" />);
    const input = screen.getByLabelText('Job description');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy!)).toHaveTextContent('Required');
  });

  it('disables the input and Remove button when disabled', async () => {
    const onChange = vi.fn();
    render(
      <FileDropzone
        label="Job description"
        value={[makeFile('jd.pdf')]}
        onChange={onChange}
        disabled
      />,
    );
    expect(screen.getByLabelText('Job description')).toBeDisabled();
    expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled();
  });
});
