import * as React from "react";

const TABLET_BREAKPOINT = 768;

export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsTablet(window.innerWidth < TABLET_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsTablet(window.innerWidth < TABLET_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isTablet;
}
