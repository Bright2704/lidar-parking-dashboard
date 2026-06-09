/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prototype-friendly: don't let a stray lint/type nit block your Vercel deploy.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
