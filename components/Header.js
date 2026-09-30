import Head from "next/head";
import { useRouter } from "next/router";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const DEFAULT_DESCRIPTION = "The Blackdog team’s weekly raffle. One winner, picked at random and fetched by the dog.";
const IMAGE = {
  url: `${SITE_URL}/api/og`,
  width: "1200",
  height: "630",
  alt: "The Blackdog pup holding a bone that says “You?”",
};

/**
 * Per-page <head> tags, including the Open Graph / Twitter tags that link
 * previews (iMessage, Google Chat, Slack…) read. Pass `title` to prefix the app
 * name. Signed-out visitors, which is what link unfurlers are, only ever reach
 * the home page, so its tags are the ones people see in a preview.
 */
export default function Header({ title, description = DEFAULT_DESCRIPTION }) {
  const { asPath } = useRouter();
  const fullTitle = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  const url = SITE_URL + asPath.split(/[?#]/)[0];
  // Keys let a page's <Header> replace the defaults _app renders instead of duplicating them.
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} key="description" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" key="viewport" />
      <meta name="theme-color" content="#070709" key="theme-color" />
      <link rel="icon" href="/favicon.ico" sizes="48x48" key="icon-ico" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" key="icon-svg" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" key="apple-touch-icon" />

      <meta property="og:type" content="website" key="og:type" />
      <meta property="og:site_name" content={SITE_NAME} key="og:site_name" />
      <meta property="og:title" content={title ?? SITE_NAME} key="og:title" />
      <meta property="og:description" content={description} key="og:description" />
      <meta property="og:url" content={url} key="og:url" />
      <meta property="og:image" content={IMAGE.url} key="og:image" />
      <meta property="og:image:type" content="image/png" key="og:image:type" />
      <meta property="og:image:width" content={IMAGE.width} key="og:image:width" />
      <meta property="og:image:height" content={IMAGE.height} key="og:image:height" />
      <meta property="og:image:alt" content={IMAGE.alt} key="og:image:alt" />
      <meta name="twitter:card" content="summary_large_image" key="twitter:card" />
      <meta name="twitter:title" content={title ?? SITE_NAME} key="twitter:title" />
      <meta name="twitter:description" content={description} key="twitter:description" />
      <meta name="twitter:image" content={IMAGE.url} key="twitter:image" />
      <meta name="twitter:image:alt" content={IMAGE.alt} key="twitter:image:alt" />
    </Head>
  );
}
