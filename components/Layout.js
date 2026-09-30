import Nav from "./Nav";
import RouteProgress from "./RouteProgress";

/** App shell: backdrop, top bar and the content column. */
export default function Layout({ children }) {
  return (
    <div className="stage-bg relative flex min-h-dvh flex-col">
      <div aria-hidden="true" className="stage-dots pointer-events-none absolute inset-0 z-0" />
      <RouteProgress />
      <Nav />
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pt-8 pb-20 sm:px-6">{children}</main>
      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-6 text-center text-xs text-ink-500 sm:px-6">
        Made with ♥ for the Blackdog team
      </footer>
    </div>
  );
}
