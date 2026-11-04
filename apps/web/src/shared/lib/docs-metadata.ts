import type { Metadata } from "next";

import { APP_URL } from "@/shared/config/env.client";

export function buildDocsCanonical(baseUrl: string, url: string): string {
  return `${baseUrl.replace(/\/$/, "")}${url}`;
}

export function buildDocsMetadata(params: {
  description?: string;
  title: string;
  url: string;
}): Metadata {
  const canonical = buildDocsCanonical(APP_URL, params.url);

  return {
    alternates: { canonical },
    description: params.description,
    openGraph: {
      description: params.description,
      siteName: "Doxynix",
      title: params.title,
      type: "website",
      url: canonical,
    },
    title: params.title,
    twitter: {
      card: "summary_large_image",
      description: params.description,
      title: params.title,
    },
  };
}
