import * as React from "react";

export function useScreen(minWidth) {
  const [isMatch, setIsMatch] = React.useState(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(width >= ${minWidth})`);
    const onChange = (e) => {
      const isMatch = e.matches;
      setIsMatch(isMatch);
    };
    mql.addEventListener("change", onChange);
    setIsMatch(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMatch;
}
