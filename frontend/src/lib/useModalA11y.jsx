'use client';
import { useEffect, useRef } from 'react';

/**
 * Reusable WCAG-compliant Modal Accessibility Hook
 * - Traps Tab / Shift+Tab focus cycle within the modal dialog
 * - Listens for Escape key to trigger onClose
 * - Auto-focuses the first focusable element (or initialFocusRef) on open
 * - Restores focus to trigger element on close
 * - Prevents background body scroll while modal is active
 */
export function useModalA11y({ isOpen, onClose, initialFocusRef }) {
  const modalRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // 1. Remember previously active element to restore focus on exit
    if (typeof document !== 'undefined') {
      previousActiveElementRef.current = document.activeElement;
    }

    // 2. Prevent background body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 3. Auto-focus initial element or first focusable element
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    }, 50);

    // 4. Trap focus and Escape key listener
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
        return;
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusables = Array.from(
          modalRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift + Tab -> if currently on first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab -> if currently on last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;

      // Restore focus to trigger element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen, onClose, initialFocusRef]);

  return { modalRef };
}

/**
 * Reusable WCAG AA accessible Modal Shell
 */
export function ModalShell({
  isOpen,
  onClose,
  title,
  titleId = 'modal-heading',
  children,
  maxWidth = 'max-w-lg',
  className = '',
}) {
  const { modalRef } = useModalA11y({ isOpen, onClose });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`bg-[#0b1120] border border-slate-800 rounded-2xl w-full ${maxWidth} p-6 shadow-2xl animate-fade-in text-left relative ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
