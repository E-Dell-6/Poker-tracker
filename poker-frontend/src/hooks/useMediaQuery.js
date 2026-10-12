import { useEffect, useState } from 'react';

// True while the CSS media query matches, updating as the window resizes.
// False where matchMedia doesn't exist (jsdom in tests), so components
// fall back to their wide-screen layout there.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

export default useMediaQuery;
