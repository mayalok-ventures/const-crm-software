'use client';
import { createContext, useContext } from 'react';

/**
 * Context communicating whether AppShell is actively managing
 * persistent tab instances for Leads and Pipeline.
 */
export const PersistentTabContext = createContext({
  isPersistentTabsEnabled: false,
  activeModule: null,
  switchTab: () => {},
});

export const usePersistentTab = () => useContext(PersistentTabContext);
