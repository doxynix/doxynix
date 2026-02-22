import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#09090b",
    description: "AI Repo Analysis & Documentation Generator",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/favicon.ico",
        type: "image/x-icon",
      },
      {
        purpose: "maskable",
        sizes: "192x192",
        src: "/icons/icon-192x192.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/icons/icon-512x512.png",
        type: "image/png",
      },
    ],
    name: "Doxynix",
    short_name: "Doxynix",
    start_url: "/dashboard",
    theme_color: "#09090b",
  };
}
