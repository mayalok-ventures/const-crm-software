'use client';

import React from 'react';
import { PersistentTabContext } from '@/components/common/PersistentTabContext';

/**
 * Clean Tab Manager
 * Passes through children directly to Next.js App Router for instant, reliable route transitions.
 * Preserves PersistentTabContext interface for backward compatibility.
 */
export default function PersistentTabManager({ children }) {
  return (
    <PersistentTabContext.Provider
      value={{
        isPersistentTabsEnabled: false,
        activeModule: null,
        switchTab: () => {},
      }}
    >
      <div className="persistent-tabs-root w-full">
        {children}
      </div>
    </PersistentTabContext.Provider>
  );
}
