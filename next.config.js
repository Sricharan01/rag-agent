/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // pdf-parse and mammoth must run in Node.js runtime (not Edge)
  // Note: serverComponentsExternalPackages is the correct key for Next.js 14
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

module.exports = nextConfig;
