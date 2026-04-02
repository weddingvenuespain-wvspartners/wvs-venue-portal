/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['weddingvenuesspain.com'],
  },
  // Desactivar React Strict Mode para evitar doble render en dev
  reactStrictMode: false,
}

module.exports = nextConfig
