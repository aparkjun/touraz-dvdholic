/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  turbopack: {
    root: require('path').resolve(__dirname, '..'),
  },
  async rewrites() {
    const apiBase = process.env.API_URL
      || (process.env.NODE_ENV === 'production'
        ? 'http://localhost:3001'
        : 'http://localhost:8080');
    return [
      { source: '/favicon.ico', destination: '/favicon-snake.png' },
      { source: '/api/:path*', destination: `${apiBase}/api/:path*` },
      { source: '/oauth2/:path*', destination: `${apiBase}/oauth2/:path*` },
      { source: '/login/oauth2/code/:path*', destination: `${apiBase}/login/oauth2/code/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'img.icons8.com' },
      { protocol: 'https', hostname: 'touraz-dvdholic-2507bcb348dd.herokuapp.com' },
      { protocol: 'https', hostname: 'cdnjs.cloudflare.com' },
      { protocol: 'https', hostname: 'raw.githubusercontent.com' },
    ],
  },
};

module.exports = nextConfig;
