'use client';

import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

export default function AdminLayout({
  activeTab,
  onSelectTab,
  onRefresh,
  refreshing,
  currentUser,
  onAddLead,
  onBroadcast,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#070b14] text-slate-100 antialiased font-sans">
      {/* ─────────────────────────────────────────────────────────────
          1. DESKTOP SIDEBAR COLUMN (Reserved 16rem in-flow column)
      ────────────────────────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 h-full">
        <AdminSidebar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          onRefresh={onRefresh}
          refreshing={refreshing}
          currentUser={currentUser}
        />
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. MOBILE DRAWER (Only rendered when mobile menu is open)
      ────────────────────────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Panel */}
          <div className="relative w-64 max-w-[80vw] h-full flex flex-col z-50 shadow-2xl animate-fadeIn">
            <AdminSidebar
              activeTab={activeTab}
              onSelectTab={onSelectTab}
              onRefresh={onRefresh}
              refreshing={refreshing}
              currentUser={currentUser}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. MAIN WORKSPACE AREA (Sibling taking all remaining width)
      ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <AdminHeader
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onAddLead={onAddLead}
          onBroadcast={onBroadcast}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar bg-[#070b14] pb-mobile-nav md:pb-6">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
