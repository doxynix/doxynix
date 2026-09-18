import type { ReactNode } from "react";
import type { SearchParams } from "nuqs/server";

/**
 * Params for repository pages
 */
export type RepoPageParams = {
  name: string;
  owner: string;
};

/**
 * Props for Page
 */
export type PageProps<TParams = Record<string, string>> = {
  params: Promise<TParams>;
  searchParams: Promise<SearchParams>;
};

/**
 * Props for Layout
 */
export type LayoutProps<TParams = Record<string, string>> = {
  children: ReactNode;
  params: Promise<TParams>;
};

export type RepoPageProps = PageProps<RepoPageParams>;
export type RepoLayoutProps = LayoutProps<RepoPageParams>;
