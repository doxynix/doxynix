import type { MetadataRoute } from "next";

export type PublicRoute = {
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  path: string;
  priority: number;
};

export const PUBLIC_ROUTES: PublicRoute[] = [
  { changeFrequency: "daily", path: "", priority: 1.0 },
  { changeFrequency: "weekly", path: "about", priority: 0.8 },
  { changeFrequency: "weekly", path: "support", priority: 0.8 },
  { changeFrequency: "weekly", path: "high-five", priority: 0.7 },
  { changeFrequency: "monthly", path: "privacy", priority: 0.3 },
  { changeFrequency: "monthly", path: "terms", priority: 0.3 },
];
