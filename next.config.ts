/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: [
    'pg',
    'pg-pool',
    'pg-native',
    '@google-cloud/bigquery',
    'googleapis',
    'google-auth-library',
    'exceljs',
    'libsodium-wrappers',
  ],
};

export default nextConfig;
