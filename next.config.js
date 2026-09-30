/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Only the Google avatar goes through next/image; employee photos use a
    // plain <img> with an initials fallback so any host works.
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  // The share-image routes (lib/share-image.js) read these from disk at runtime.
  outputFileTracingIncludes: {
    "/api/card/*": ["./assets/fonts/**"],
    "/api/og": ["./assets/fonts/**"],
  },
};

module.exports = nextConfig;
