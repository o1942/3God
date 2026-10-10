import { useToasts } from '../store/toast';

const STYLE: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  info:    { bg: 'bg-blue-500/95',    border: 'border-blue-400',    text: 'text-white', icon: 'ℹ️' },
  success: { bg: 'bg-emerald-500/95', border: 'border-emerald-400', text: 'text-white', icon: '✅' },
  warning: { bg: 'bg-amber-500/95',  border: 'border-amber-400',  text: 'text-white', icon: '⚠️' },
  error:   { bg: 'bg-red-500/95',    border: 'border-red-400',    text: 'text-white', icon: '❌' },
};

export function ToastContainer() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 z-[100] flex flex-col gap-2 max-w-[calc(100vw-24px)] w-72 pointer-events-none">
      {toasts.map((t) => {
        const s = STYLE[t.type];
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`
              anim-toast pointer-events-auto cursor-pointer
              ${s.bg} ${s.border} ${s.text}
              border rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 text-sm
            `}
          >
            <span className="text-base">{s.icon}</span>
            <span className="flex-1">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
