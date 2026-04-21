import { motion, AnimatePresence } from 'framer-motion';
import type { Toast } from '../../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 52,
      right: 24,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: 8,
      width: 280,
    }}>
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={() => onRemove(toast.id)}
            style={{
              background: 'var(--card-hover)',
              border: '1px solid var(--border-2)',
              borderRadius: 'var(--radius)',
              padding: '12px 16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
          >
            {toast.icon && (
              <span style={{ fontSize: 16, flexShrink: 0 }}>{toast.icon}</span>
            )}
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'var(--t1)', flex: 1 }}>
              {toast.message}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
