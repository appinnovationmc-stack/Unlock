/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  transpilePackages: ["maplibre-gl"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }]
  }
};

module.exports = nextConfig;
