import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, CircleNotch, WarningCircle } from '@phosphor-icons/react';

export type ToastKind = 'busy' | 'success' | 'error';
interface ToastState {
  kind: ToastKind;
  message: string;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((kind: ToastKind, message: string) => {
    clearTimeout(timer.current);
    setToast({ kind, message });
    if (kind !== 'busy') timer.current = setTimeout(() => setToast(null), kind === 'error' ? 6000 : 2500);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, show };
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  const Icon = toast.kind === 'busy' ? CircleNotch : toast.kind === 'success' ? CheckCircle : WarningCircle;
  return (
    <div
      role="status"
      className="pointer-events-auto flex max-w-[min(560px,calc(100%-32px))] items-center gap-[8px] rounded-[12px] bg-ink px-[16px] py-[10px] text-[12px] leading-[1.5] [overflow-wrap:anywhere] text-white shadow-[0_8px_24px_rgba(2,14,30,0.25)]"
    >
      <Icon
        size={16}
        weight={toast.kind === 'busy' ? 'bold' : 'fill'}
        className={`shrink-0 ${toast.kind === 'busy' ? 'animate-spin' : toast.kind === 'success' ? 'text-[#a8f39b]' : 'text-[#fc835e]'}`}
      />
      {toast.message}
    </div>
  );
}
