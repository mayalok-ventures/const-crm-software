'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useContextMenu } from './ContextMenuContext';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Layers,
  PlusCircle,
  Eye,
  CalendarPlus,
  PhoneCall,
  Copy,
  Edit3,
  CheckCircle2,
  Clock,
  History,
  Settings,
  Activity,
  ScrollText,
  RefreshCw,
  Unlink,
  ExternalLink,
  Phone,
  MessageCircle,
} from 'lucide-react';

export default function ContextMenu() {
  const { menuState, closeMenu, executeAction, menuRef } = useContextMenu();
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef([]);

  const { isOpen, x, y, type, record } = menuState;

  // Build items list dynamically based on context type
  let items = [];

  if (type === 'global') {
    items = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        onClick: () => executeAction('NAV_DASHBOARD'),
      },
      {
        id: 'leads',
        label: 'Leads',
        icon: Users,
        onClick: () => executeAction('NAV_LEADS'),
      },
      {
        id: 'followups',
        label: 'Follow-ups',
        icon: CalendarCheck,
        onClick: () => executeAction('NAV_FOLLOWUPS'),
      },
      {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: MessageCircle,
        onClick: () => executeAction('NAV_WHATSAPP'),
      },
      {
        id: 'divider-1',
        isDivider: true,
      },
      {
        id: 'create-lead',
        label: 'Create Lead',
        icon: PlusCircle,
        primary: true,
        onClick: () => executeAction('NAV_CREATE_LEAD'),
      },
    ];
  } else if (type === 'lead') {
    items = [
      {
        id: 'open-lead',
        label: 'Open Lead Details',
        icon: Eye,
        onClick: () => executeAction('OPEN_LEAD', record),
      },
      {
        id: 'add-followup',
        label: 'Schedule Follow-up',
        icon: CalendarPlus,
        onClick: () => executeAction('SCHEDULE_FOLLOWUP', record),
      },
      {
        id: 'log-call',
        label: 'Log Call / Activity',
        icon: PhoneCall,
        onClick: () => executeAction('LOG_CALL', record),
      },
      {
        id: 'copy-phone',
        label: record?.phone ? `Copy ${record.phone}` : 'Copy Phone Number',
        icon: Copy,
        onClick: () => executeAction('COPY_PHONE', record),
      },
      {
        id: 'divider-lead',
        isDivider: true,
      },
      {
        id: 'edit-lead',
        label: 'Edit Lead',
        icon: Edit3,
        onClick: () => executeAction('EDIT_LEAD', record),
      },
    ];
  } else if (type === 'followup') {
    items = [
      {
        id: 'open-related-lead',
        label: 'Open Related Lead',
        icon: Eye,
        onClick: () => executeAction('OPEN_LEAD', record),
      },
      {
        id: 'mark-complete',
        label: 'Mark Complete',
        icon: CheckCircle2,
        primary: true,
        onClick: () => executeAction('COMPLETE_FOLLOWUP', record),
      },
      {
        id: 'reschedule',
        label: 'Reschedule Follow-up',
        icon: Clock,
        onClick: () => executeAction('SCHEDULE_FOLLOWUP', record),
      },
      {
        id: 'copy-contact',
        label: record?.phone ? `Copy ${record.phone}` : 'Copy Contact Number',
        icon: Copy,
        onClick: () => executeAction('COPY_PHONE', record),
      },
      {
        id: 'divider-followup',
        isDivider: true,
      },
      {
        id: 'view-history',
        label: 'View Activity History',
        icon: History,
        onClick: () => executeAction('VIEW_LEAD_HISTORY', record),
      },
    ];
  } else if (type === 'integration') {
    items = [
      {
        id: 'settings',
        label: 'Configure / Settings',
        icon: Settings,
        onClick: () => executeAction('OPEN_INTEGRATION_SETTINGS', record),
      },
      {
        id: 'test-connection',
        label: 'Test Connection',
        icon: Activity,
        onClick: () => executeAction('TEST_INTEGRATION', record),
      },
      {
        id: 'sync-logs',
        label: 'View Sync History & Logs',
        icon: ScrollText,
        onClick: () => executeAction('VIEW_INTEGRATION_LOGS', record),
      },
      {
        id: 'reconnect',
        label: 'Reconnect Provider',
        icon: RefreshCw,
        onClick: () => executeAction('RECONNECT_INTEGRATION', record),
      },
      {
        id: 'divider-int',
        isDivider: true,
      },
      {
        id: 'disconnect',
        label: 'Disconnect Integration',
        icon: Unlink,
        danger: true,
        onClick: () => executeAction('DISCONNECT_INTEGRATION', record),
      },
    ];
  }

  const actionableItems = items.filter((i) => !i.isDivider);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(0);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % actionableItems.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + actionableItems.length) % actionableItems.length);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setActiveIndex(actionableItems.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (actionableItems[activeIndex]?.onClick) {
          actionableItems[activeIndex].onClick();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, actionableItems]);

  // Focus active button when activeIndex changes
  useEffect(() => {
    if (isOpen && itemsRef.current[activeIndex]) {
      itemsRef.current[activeIndex].focus();
    }
  }, [isOpen, activeIndex]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="CRM Context Menu"
      tabIndex={-1}
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
      }}
      className="z-[9999999] min-w-[210px] max-w-[280px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-1.5 text-slate-100 text-xs font-medium animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* Context Badge Header */}
      <div className="px-2.5 py-1 mb-1 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
        <span>
          {type === 'global' && 'CRM Shortcuts'}
          {type === 'lead' && (record?.name ? `Lead: ${record.name.slice(0, 16)}` : 'Lead Actions')}
          {type === 'followup' && 'Follow-up Actions'}
          {type === 'integration' && (record?.accountName || record?.provider ? `${record.accountName || record.provider}` : 'Integration')}
        </span>
        <span className="text-[9px] text-slate-500 font-mono">ESC to close</span>
      </div>

      <div className="flex flex-col gap-0.5">
        {items.map((item, idx) => {
          if (item.isDivider) {
            return <div key={item.id} className="h-px bg-slate-800 my-1" role="separator" />;
          }

          const actionIdx = actionableItems.findIndex((a) => a.id === item.id);
          const isCurrentActive = actionIdx === activeIndex;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              ref={(el) => (itemsRef.current[actionIdx] = el)}
              role="menuitem"
              tabIndex={isCurrentActive ? 0 : -1}
              onClick={item.onClick}
              onMouseEnter={() => setActiveIndex(actionIdx)}
              className={`flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 rounded-lg transition-colors outline-none cursor-pointer ${
                item.danger
                  ? isCurrentActive
                    ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
                    : 'text-rose-400 hover:bg-rose-500/10'
                  : item.primary
                  ? isCurrentActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-300 hover:bg-indigo-600/30'
                  : isCurrentActive
                  ? 'bg-slate-800 text-white ring-1 ring-slate-700'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
