import { useCallback, useState } from 'react';

export interface Toast {
  id: string;
  message: string;
  icon?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, icon?: string) => {
    const id = Math.random().toString(36).slice(2, 10);
    const newToast: Toast = { id, message, icon };
    setToasts(prev => {
      const next = [newToast, ...prev].slice(0, 3);
      return next;
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
