'use client';

import { useEffect, useRef } from 'react';
import Button from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Footer actions — if not provided, no footer is rendered */
  footer?: React.ReactNode;
  /** Width of modal */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />

      {/* Panel */}
      <div className={`relative w-full ${widths[size]} max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-card border border-line bg-panel shadow-lg`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-line">
          <h2 className="text-base sm:text-lg font-semibold text-ink min-w-0">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-paper text-muted transition-colors duration-150"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-line">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Confirm Delete Modal ──────────────────────────────────────── */

interface ConfirmDeleteProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName: string;
  loading?: boolean;
}

export function ConfirmDelete({ open, onClose, onConfirm, itemName, loading }: ConfirmDeleteProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Delete"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading}>
            Delete {itemName}
          </Button>
        </>
      }
    >
      <p className="text-[15px] text-ink">
        Are you sure you want to delete <strong>{itemName}</strong>? This action cannot be undone.
      </p>
    </Modal>
  );
}
