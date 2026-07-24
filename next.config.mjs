/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nodemailer resolves transports and TLS through Node built-ins at runtime,
  // which the Server Components bundler cannot trace. Keep it a real require.
  serverExternalPackages: ["nodemailer"],
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
