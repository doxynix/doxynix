import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#111318",
    description: "AI Repo Analysis & Documentation Generator",
    display: "standalone",
    icons: [
      {
        sizes: "any",
        src: "/favicon.ico",
        type: "image/x-icon",
      },
      {
        purpose: "any",
        sizes: "192x192",
        src: "/icons/icon-192x192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/icons/icon-512x512.png",
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
    scope: "/",
    short_name: "Doxynix",
    shortcuts: [
      {
        description: "Open your active repositories",
        name: "Repositories",
        url: "/dashboard/repos",
      },
      {
        description: "View repository notifications",
        name: "Notifications",
        url: "/dashboard/notifications",
      },
    ],
    start_url: "/dashboard",
    theme_color: "#111318",
  };
}
