'use client';
import { useEffect } from 'react';

/**
 * Reusable Dirty Form Warning Hook
 * Prevents accidental loss of unsaved changes by prompting confirmation on window beforeunload
 * and providing a dirty-state check.
 */
export function useDirtyFormWarning({ isDirty = false, message = 'You have unsaved changes. Are you sure you want to leave?' } = {}) {
  useEffect(() => {
    if (!isDirty || typeof window === 'undefined') return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, message]);

  const confirmNavigation = () => {
    if (!isDirty) return true;
    if (typeof window === 'undefined') return true;
    return window.confirm(message);
  };

  return { confirmNavigation };
}
