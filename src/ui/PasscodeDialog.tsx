import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LockSimple, X } from '@phosphor-icons/react';

interface Props {
  /** Shown when a previous attempt was rejected. */
  error?: string | null;
  onSubmit: (passcode: string) => void;
  onCancel: () => void;
}

/** Asks for the admin passcode before running an "Admin only" action. */
export function PasscodeDialog({ error, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/40 p-[24px]" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="passcode-title"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[360px] flex-col gap-[16px] rounded-[12px] bg-white p-[24px] shadow-[0_16px_48px_rgba(2,14,30,0.25)]"
      >
        <div className="flex items-start justify-between gap-[12px]">
          <div className="flex flex-col gap-[4px]">
            <h2 id="passcode-title" className="flex items-center gap-[6px] text-[16px] leading-[1.4]">
              <LockSimple size={16} />
              Admin passcode
            </h2>
            <p className="text-[12px] leading-[1.5] text-ink-muted">Required for “Admin only” actions. Remembered on this browser.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded p-[2px] hover:bg-overlay-subtle">
            <X size={16} />
          </button>
        </div>
        <input
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'passcode-error' : undefined}
          className="rounded-[8px] bg-overlay-subtle px-[12px] py-[8px] text-[14px] leading-[1.5] outline-none focus:ring-2 focus:ring-accent/40"
        />
        {error && (
          <p id="passcode-error" className="-mt-[8px] text-[12px] text-[#b4441f]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!value.trim()}
          className="rounded-[8px] bg-accent px-[12px] py-[8px] text-[14px] leading-[1.5] text-white hover:bg-[#1f5fe0] disabled:opacity-50"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
