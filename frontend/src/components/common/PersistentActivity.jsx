'use client';
import React from 'react';

/**
 * React 19 Activity / Offscreen persistent container
 * Delivers instant 0ms tab transitions for CRM modules.
 * Preserves component state, DOM nodes, scroll position, and input filters.
 */
export default function PersistentActivity({ mode = 'visible', children, className = '' }) {
  const isHidden = mode === 'hidden';

  // Native React 19 Activity support
  if (React.Activity) {
    return (
      <React.Activity mode={mode}>
        <div
          className={`persistent-activity-slot ${className} ${isHidden ? 'hidden-activity' : 'visible-activity'}`}
          style={isHidden ? { display: 'none', height: 0, overflow: 'hidden' } : { display: 'block' }}
          aria-hidden={isHidden}
        >
          {children}
        </div>
      </React.Activity>
    );
  }

  // Resilient fallback
  return (
    <div
      className={`persistent-activity-slot ${className} ${isHidden ? 'hidden-activity' : 'visible-activity'}`}
      style={isHidden ? { display: 'none', height: 0, overflow: 'hidden' } : { display: 'block' }}
      aria-hidden={isHidden}
    >
      {children}
    </div>
  );
}
