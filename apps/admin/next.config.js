/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@openregister/types'],
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
