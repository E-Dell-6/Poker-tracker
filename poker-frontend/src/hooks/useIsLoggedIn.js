import { useEffect, useState } from 'react';
import { getUserData } from '../api/user';

// null = still checking, true/false = confirmed. Shared version of the
// getUserData()-then-check-success pattern each page used to duplicate.
export function useIsLoggedIn() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getUserData()
      .then(data => { if (!cancelled) setIsLoggedIn(data.success === true); })
      .catch(() => { if (!cancelled) setIsLoggedIn(false); });
    return () => { cancelled = true; };
  }, []);

  return isLoggedIn;
}

export default useIsLoggedIn;
