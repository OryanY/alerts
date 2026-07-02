import { useEffect, useState } from 'react';
import { getAuth, fetchAuthEnabled } from '../utils/api';

// Tells destructive UI whether a login is required and missing.
//   needsLogin = the server gate is on AND there's no valid session.
// Re-checks the session on window focus, so logging in on the Settings tab and
// coming back clears the hint without a reload.
export function useAuthGate() {
  const [authEnabled, setAuthEnabled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!getAuth());

  useEffect(() => {
    let alive = true;
    fetchAuthEnabled().then((en) => { if (alive) setAuthEnabled(en); });
    const sync = () => setIsLoggedIn(!!getAuth());
    window.addEventListener('focus', sync);
    return () => { alive = false; window.removeEventListener('focus', sync); };
  }, []);

  return { authEnabled, isLoggedIn, needsLogin: authEnabled && !isLoggedIn };
}
