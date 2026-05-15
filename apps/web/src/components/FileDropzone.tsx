import { useId, useState, type ChangeEvent, type DragEvent } from 'react';

export type FileDropzoneProps = {
  label: string;
  value?: File[];
  onChange: (files: File[]) => void;
  id?: string;
  name?: string;
  accept?: string;
  multiple?: boolean;
  helperText?: string;
  error?: string;
  disabled?: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileDropzone({
  label,
  value = [],
  onChange,
  id,
  name,
  accept,
  multiple = false,
  helperText,
  error,
  disabled = false,
}: FileDropzoneProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = error || helperText ? `${inputId}-message` : undefined;
  const [dragging, setDragging] = useState(false);

  function emit(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    onChange(multiple ? arr : arr.slice(0, 1));
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    emit(event.target.files);
  }

  function handleDragEnter(event: DragEvent<HTMLInputElement>) {
    event.preventDefault();
    if (!disabled) setDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLInputElement>) {
    event.preventDefault();
    setDragging(false);
  }

  function handleDrop() {
    setDragging(false);
  }

  function handleRemove(index: number) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
  }

  const zoneClass = `relative flex flex-col items-center justify-center rounded-md border-2 border-dashed p-6 text-center transition ${
    disabled
      ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
      : dragging
        ? 'border-brand-500 bg-brand-50 text-brand-800'
        : 'border-slate-300 bg-surface text-ink-muted hover:border-brand-400 hover:text-brand-700'
  }`;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className={zoneClass}>
        <input
          id={inputId}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          onChange={handleInputChange}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <div className="pointer-events-none flex flex-col items-center gap-1 text-sm">
          <span className="font-medium">Drag &amp; drop files here, or click to browse</span>
          {accept && <span className="text-xs">Accepted: {accept}</span>}
        </div>
      </div>

      {value.length > 0 && (
        <ul className="space-y-1 text-sm">
          {value.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center justify-between rounded border border-slate-200 bg-surface px-3 py-2"
            >
              <span className="truncate text-ink">
                {file.name} <span className="text-ink-muted">({formatBytes(file.size)})</span>
              </span>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                className="ml-3 text-xs font-medium text-brand-600 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {(error || helperText) && (
        <p id={messageId} className={error ? 'text-sm text-red-600' : 'text-sm text-ink-muted'}>
          {error ?? helperText}
        </p>
      )}
    </div>
  );
}

export default FileDropzone;
