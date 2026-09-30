import { useEffect, useState } from "react";
import Router from "next/router";

/**
 * Thin mint progress bar during client-side navigation. Replaces the old
 * approach of unmounting the whole page and showing a spinner.
 */
export default function RouteProgress() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timer;
    const start = () => {
      clearTimeout(timer);
      // Only show for navigations that take a noticeable moment.
      timer = setTimeout(() => setActive(true), 120);
    };
    const end = () => {
      clearTimeout(timer);
      setActive(false);
    };
    Router.events.on("routeChangeStart", start);
    Router.events.on("routeChangeComplete", end);
    Router.events.on("routeChangeError", end);
    return () => {
      clearTimeout(timer);
      Router.events.off("routeChangeStart", start);
      Router.events.off("routeChangeComplete", end);
      Router.events.off("routeChangeError", end);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-1/3 animate-progress bg-linear-to-r from-transparent via-accent-400 to-transparent" />
    </div>
  );
}
