import { useId, type TextareaHTMLAttributes } from 'react';

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string;
  id?: string;
  helperText?: string;
  error?: string;
};

const fieldClass =
  'block w-full rounded-md border border-slate-300 bg-surface px-3 py-2 text-sm text-ink shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-200';

function Textarea({
  label,
  id,
  helperText,
  error,
  rows = 4,
  className = '',
  ...rest
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = error || helperText ? `${textareaId}-message` : undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={textareaId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        className={`${fieldClass} ${className}`.trim()}
        {...rest}
      />
      {(error || helperText) && (
        <p id={messageId} className={error ? 'text-sm text-red-600' : 'text-sm text-ink-muted'}>
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}

export default Textarea;
