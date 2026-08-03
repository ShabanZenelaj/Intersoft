/** @type {import('next').NextConfig} */
const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
const { protocol, hostname, port } = new URL(backendUrl)

const isDev = process.env.NODE_ENV !== "production"

const nextConfig = {
  images: {
    // The demo catalog ships SVG placeholders served by the API.
    dangerouslyAllowSVG: true,
    // Development only, where the API answers on 127.0.0.1. In production the
    // API has a real hostname, and allowing private addresses would let the
    // image optimizer be aimed at machines inside the network.
    dangerouslyAllowLocalIP: isDev,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // Wherever the API actually lives — in production the real https domain,
      // which is where product images are served from.
      { protocol: protocol.replace(":", ""), hostname, port },
      ...(isDev
        ? [
            { protocol: "http", hostname: "localhost", port: "9000" },
            { protocol: "http", hostname: "127.0.0.1", port: "9000" },
          ]
        : []),
    ],
  },
}

export default nextConfig
