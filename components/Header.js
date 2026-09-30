import Head from "next/head";

/** Per-page <head> tags. Pass `title` to prefix the app name. */
export default function Header({ title, description = "Weekly raffle for the Blackdog team." }) {
  const fullTitle = title ? `${title} · Blackdog Raffle` : "Blackdog Raffle";
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="theme-color" content="#070709" />
      <link rel="icon" href="/favicon.ico" sizes="48x48" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    </Head>
  );
}
