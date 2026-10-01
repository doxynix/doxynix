import type { ReactNode } from "react";
import type { SearchParams } from "nuqs/server";

export type RepoPageParams = {
  name: string;
  owner: string;
};

export type PageProps<TParams = Record<string, string>> = {
  params: Promise<TParams>;
  searchParams: Promise<SearchParams>;
};

export type LayoutProps<TParams = Record<string, string>> = {
  children: ReactNode;
  params: Promise<TParams>;
};

export type RepoPageProps = PageProps<RepoPageParams>;
export type RepoLayoutProps = LayoutProps<RepoPageParams>;
