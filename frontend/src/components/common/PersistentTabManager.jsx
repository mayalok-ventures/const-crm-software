'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import PersistentActivity from '@/components/common/PersistentActivity';
import { PersistentTabContext } from '@/components/common/PersistentTabContext';
import { getUser } from '@/lib/auth';
import LeadsContent from '@/components/leads/LeadsContent';
import PipelineContent from '@/components/pipeline/PipelineContent';

/**
 * React 19 Activity Persistent Tab Manager
 * Manages persistent warm instances of Leads and Pipeline views.
 * Preserves scroll, form inputs, filters, and DOM state with 0ms tab switching.
 * Guarantees zero cross-tenant leakage via tenantKey remounting.
 */
export default function PersistentTabManager({ children }) {
  const pathname = usePathname();
  const [user, setUser] = useState(() => getUser());

  useEffect(() => {
    const handleUserUpdate = () => {
      setUser(getUser());
    };
    window.addEventListener('user-updated', handleUserUpdate);
    return () => window.removeEventListener('user-updated', handleUserUpdate);
  }, []);

  // Feature Flag: enabled by default; can be disabled with NEXT_PUBLIC_PERSISTENT_TABS === 'false'
  const isFeatureEnabled = process.env.NEXT_PUBLIC_PERSISTENT_TABS !== 'false';

  const cleanPath = (pathname || '').replace(/\/$/, '') || '/';
  const isLeadsTab = cleanPath === '/leads';
  const isPipelineTab = cleanPath === '/pipeline';

  const [optimisticTab, setOptimisticTab] = useState(null);

  // Sync optimistic tab when Next.js pathname updates
  useEffect(() => {
    setOptimisticTab(null);
  }, [cleanPath]);

  // Listen to custom tab switch event dispatched from BottomNav or router links
  useEffect(() => {
    const handleTabSwitch = (e) => {
      const tab = e?.detail;
      if (tab === 'leads' || tab === 'pipeline') {
        setOptimisticTab(tab);
        setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
      } else {
        setOptimisticTab(null);
      }
    };
    window.addEventListener('persistent-tab-switch', handleTabSwitch);
    return () => window.removeEventListener('persistent-tab-switch', handleTabSwitch);
  }, []);

  const effectiveTab = optimisticTab || (isLeadsTab ? 'leads' : isPipelineTab ? 'pipeline' : null);
  const isEffectiveLeads = effectiveTab === 'leads';
  const isEffectivePipeline = effectiveTab === 'pipeline';
  const isPersistentModule = isEffectiveLeads || isEffectivePipeline;

  // Mount only on-demand when the user first visits the tab
  const [visitedTabs, setVisitedTabs] = useState(() => {
    const initial = new Set();
    if (isLeadsTab) initial.add('leads');
    if (isPipelineTab) initial.add('pipeline');
    return initial;
  });

  useEffect(() => {
    if (isLeadsTab) {
      setVisitedTabs((prev) => (prev.has('leads') ? prev : new Set(prev).add('leads')));
    } else if (isPipelineTab) {
      setVisitedTabs((prev) => (prev.has('pipeline') ? prev : new Set(prev).add('pipeline')));
    }
  }, [isLeadsTab, isPipelineTab]);

  // Strict tenant boundary: Changing workspace or user unmounts and purges persistent state
  const wsId = user?.currentWorkspace?._id || user?.currentWorkspace || user?.workspaceId || user?.companyId || user?._id || 'solo';
  const tenantKey = user ? `${user._id || 'anon'}_${wsId}` : 'anonymous_session';

  if (!isFeatureEnabled) {
    return (
      <PersistentTabContext.Provider value={{ isPersistentTabsEnabled: false, activeModule: null, switchTab: () => {} }}>
        {children}
      </PersistentTabContext.Provider>
    );
  }

  const switchTab = (tabName) => {
    if (tabName === 'leads' || tabName === 'pipeline') {
      setOptimisticTab(tabName);
      setVisitedTabs((prev) => (prev.has(tabName) ? prev : new Set(prev).add(tabName)));
    }
  };

  return (
    <PersistentTabContext.Provider
      value={{
        isPersistentTabsEnabled: true,
        activeModule: effectiveTab,
        switchTab,
      }}
    >
      <div key={tenantKey} className="persistent-tabs-root w-full">
        {/* Persistent Leads Tab Slot */}
        {visitedTabs.has('leads') && (
          <PersistentActivity mode={isEffectiveLeads ? 'visible' : 'hidden'}>
            <Suspense fallback={null}>
              <LeadsContent />
            </Suspense>
          </PersistentActivity>
        )}

        {/* Persistent Pipeline Tab Slot */}
        {visitedTabs.has('pipeline') && (
          <PersistentActivity mode={isEffectivePipeline ? 'visible' : 'hidden'}>
            <Suspense fallback={null}>
              <PipelineContent />
            </Suspense>
          </PersistentActivity>
        )}

        {/* Transient Route Slot: active for /dashboard, /deals, /follow-ups, /leads/[id], etc. */}
        <div style={{ display: isPersistentModule ? 'none' : 'block' }}>
          {children}
        </div>
      </div>
    </PersistentTabContext.Provider>
  );
}
