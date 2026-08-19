'use client';
/**
 * AlarmContext — global follow-up alarm state accessible from any page component.
 * When a user takes action on a lead (call, WA, note, status change), call dismissAlarm(leadId)
 * from anywhere in the app to instantly clear the alarm without waiting for the 45s poll.
 */
import { createContext, useContext, useCallback, useRef } from 'react';

const AlarmContext = createContext(null);

export function AlarmProvider({ children }) {
  // Stores the setter from FollowUpAlertManager so we can call it globally
  const setterRef = useRef(null);

  const register = useCallback((setter) => {
    setterRef.current = setter;
  }, []);

  // Call this from any lead action (call button, WA send, note save, status change)
  const dismissAlarm = useCallback((leadId) => {
    if (setterRef.current) {
      setterRef.current(prev => prev.filter(l => l._id !== leadId));
    }
  }, []);

  return (
    <AlarmContext.Provider value={{ register, dismissAlarm }}>
      {children}
    </AlarmContext.Provider>
  );
}

export function useAlarm() {
  const ctx = useContext(AlarmContext);
  if (!ctx) {
    // Graceful fallback if used outside provider
    return { register: () => {}, dismissAlarm: () => {} };
  }
  return ctx;
}
