/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Google profile photos, served from lh3/lh4/lh5.googleusercontent.com.
      { protocol: "https", hostname: "*.googleusercontent.com" },
      // Placeholder screenshots used by the marketing hero.
      { protocol: "https", hostname: "deifkwefumgah.cloudfront.net" },
    ],
  },
};

export default nextConfig;
