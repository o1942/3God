// Toast 提示系统
import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type ToastStore = {
  toasts: Toast[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: string) => void;
};

const TOAST_TTL_MS = 3000; // 3 秒自动消失

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (type, message) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    // 自动消失
    setTimeout(() => {
      get().dismiss(id);
    }, TOAST_TTL_MS);
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

// 便捷函数
export const toast = {
  info: (msg: string) => useToasts.getState().push('info', msg),
  success: (msg: string) => useToasts.getState().push('success', msg),
  warning: (msg: string) => useToasts.getState().push('warning', msg),
  error: (msg: string) => useToasts.getState().push('error', msg),
};
