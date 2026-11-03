import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";

import { buildDocsMetadata } from "@/shared/lib/docs-metadata";
import { docsSource } from "@/shared/lib/docs-source";

type DocsPageProps = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

export function generateStaticParams() {
  return docsSource.generateParams();
}

export async function generateMetadata(props: DocsPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const page = docsSource.getPage(slug);

  if (page == null) {
    notFound();
  }

  return buildDocsMetadata({
    description: page.data.description,
    title: page.data.title,
    url: page.url,
  });
}

export default async function DocsPageRoute(props: DocsPageProps) {
  const { slug } = await props.params;
  const page = docsSource.getPage(slug);

  if (page == null) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage
      full={page.data.full}
      toc={page.data.toc}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            a: createRelativeLink(docsSource, page),
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}
