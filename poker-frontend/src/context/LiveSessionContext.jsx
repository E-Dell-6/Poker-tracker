import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getActiveLiveSession } from '../api/liveSessions';

const LiveSessionContext = createContext(null);

// Shared "is there a live session running right now" state, provided once
// per Layout instance so the Sidebar's badge and the Clock page's own
// clock-in/clock-out actions - siblings under the same Layout - can stay
// in sync without a page navigation. Clock.jsx calls setActiveSession()
// directly after a successful clock-in/clock-out instead of the Sidebar
// having to poll or refetch on some interval.
export function LiveSessionProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);

  const refreshActiveSession = useCallback(async () => {
    try {
      setActiveSession(await getActiveLiveSession());
    } catch {
      setActiveSession(null);
    }
  }, []);

  useEffect(() => {
    refreshActiveSession();
  }, [refreshActiveSession]);

  return (
    <LiveSessionContext.Provider value={{ activeSession, setActiveSession, refreshActiveSession }}>
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSession() {
  const ctx = useContext(LiveSessionContext);
  if (!ctx) throw new Error('useLiveSession must be used within a LiveSessionProvider');
  return ctx;
}
