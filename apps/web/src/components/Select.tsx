import { useId, type SelectHTMLAttributes } from 'react';

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> & {
  label: string;
  id?: string;
  options: ReadonlyArray<SelectOption>;
  helperText?: string;
  error?: string;
  placeholder?: string;
};

const fieldClass =
  'block w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-ink shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-200';

function Select({
  label,
  id,
  options,
  helperText,
  error,
  placeholder,
  className = '',
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const messageId = error || helperText ? `${selectId}-message` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={`${fieldClass} ${className}`.trim()}
        {...rest}
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {(error || helperText) && (
        <p id={messageId} className={error ? 'text-sm text-red-600' : 'text-sm text-ink-muted'}>
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}

export default Select;
