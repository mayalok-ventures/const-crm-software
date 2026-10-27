'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getUser } from '@/lib/auth';

const ContextMenuContext = createContext(null);

export function ContextMenuProvider({ children }) {
  const router = useRouter();
  const [menuState, setMenuState] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'global', // 'global' | 'lead' | 'followup' | 'integration'
    record: null,
  });

  const menuRef = useRef(null);

  const closeMenu = useCallback(() => {
    setMenuState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  }, []);

  const openMenu = useCallback(({ x, y, type, record }) => {
    // Keep menu within viewport bounds (clamp values)
    const menuWidth = 240;
    const menuHeight = 280;
    const padding = 12;

    const clampedX = Math.min(
      Math.max(padding, x),
      typeof window !== 'undefined' ? window.innerWidth - menuWidth - padding : x
    );
    const clampedY = Math.min(
      Math.max(padding, y),
      typeof window !== 'undefined' ? window.innerHeight - menuHeight - padding : y
    );

    setMenuState({
      isOpen: true,
      x: clampedX,
      y: clampedY,
      type: type || 'global',
      record: record || null,
    });
  }, []);

  // Global listener for right-click anywhere on the screen across the entire CRM
  useEffect(() => {
    const handleContextMenu = (e) => {
      // 1. Unconditionally suppress default Chrome popup menu everywhere across the entire CRM
      e.preventDefault();
      e.stopPropagation();

      // 2. Always display the specific set of 5 CRM shortcuts regardless of target or location
      openMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'global',
        record: null,
      });
    };

    // Use capture phase so no child component, toolbar, or DOM node can bypass this handler
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    document.addEventListener('contextmenu', handleContextMenu, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    };
  }, [openMenu]);

  // Close menu on click outside or Escape key
  useEffect(() => {
    if (!menuState.isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('touchstart', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuState.isOpen, closeMenu]);

  // Dispatch custom actions to page listeners
  const executeAction = useCallback(
    (actionName, payload = {}) => {
      closeMenu();

      // Trigger custom window event so active pages can open specific modals
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('crm-context-action', {
          detail: { action: actionName, payload, timestamp: Date.now() },
        });
        window.dispatchEvent(event);
      }

      // Execute built-in navigation and helper actions
      switch (actionName) {
        case 'NAV_DASHBOARD':
          router.push('/dashboard');
          break;
        case 'NAV_LEADS':
          router.push('/leads');
          break;
        case 'NAV_FOLLOWUPS':
          router.push('/follow-ups');
          break;
        case 'NAV_WHATSAPP':
          if (payload?.phone || payload?.contact) {
            const raw = payload.phone || payload.contact;
            const clean = String(raw).replace(/\D/g, '');
            const full = clean.length === 10 ? `91${clean}` : clean;
            router.push(`/whatsapp?chat=${full}`);
          } else {
            router.push('/whatsapp');
          }
          break;
        case 'NAV_INTEGRATIONS':
          router.push('/integrations');
          break;
        case 'NAV_CREATE_LEAD':
          router.push('/leads?action=create');
          break;
        case 'COPY_PHONE': {
          const phone = payload?.phone || payload?.contact;
          if (phone) {
            navigator.clipboard.writeText(phone);
            toast.success(`Copied ${phone} to clipboard`);
          } else {
            toast.error('No phone number available to copy');
          }
          break;
        }
        default:
          break;
      }
    },
    [closeMenu, router]
  );

  return (
    <ContextMenuContext.Provider
      value={{
        menuState,
        openMenu,
        closeMenu,
        executeAction,
        menuRef,
      }}
    >
      {children}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider');
  }
  return context;
}
