import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#09090b",
    description: "Code analysis and documentation tool",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/favicon.ico",
        type: "image/x-icon",
      },
      {
        sizes: "192x192",
        src: "/icons/icon-192x192.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/icons/icon-512x512.png",
        type: "image/png",
      },
    ],
    name: "Doxynix",
    short_name: "Doxynix",
    start_url: "/dashboard",
    theme_color: "#22c55e",
  };
}
