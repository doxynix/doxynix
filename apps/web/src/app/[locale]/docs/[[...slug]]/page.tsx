import type { ComponentProps } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/notebook/page";
import defaultMdxComponents, { createRelativeLink } from "fumadocs-ui/mdx";

import { buildDocsMetadata } from "@/shared/lib/docs-metadata";
import { docsSource } from "@/shared/lib/docs-source";
import { DocsCodeBlock } from "@/shared/ui/kit/docs-code-block";
import { DocsHeading } from "@/shared/ui/kit/docs-heading";

type DocsPageProps = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

const h2 = (props: ComponentProps<"h2">) => (
  <DocsHeading
    as="h2"
    {...props}
  />
);
const h3 = (props: ComponentProps<"h3">) => (
  <DocsHeading
    as="h3"
    {...props}
  />
);
const h4 = (props: ComponentProps<"h4">) => (
  <DocsHeading
    as="h4"
    {...props}
  />
);
const h5 = (props: ComponentProps<"h5">) => (
  <DocsHeading
    as="h5"
    {...props}
  />
);
const h6 = (props: ComponentProps<"h6">) => (
  <DocsHeading
    as="h6"
    {...props}
  />
);

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
      id="main-content"
      tabIndex={-1}
      toc={page.data.toc}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={{
            ...defaultMdxComponents,
            a: createRelativeLink(docsSource, page),
            h2,
            h3,
            h4,
            h5,
            h6,
            pre: DocsCodeBlock,
          }}
        />
      </DocsBody>
    </DocsPage>
  );
}
