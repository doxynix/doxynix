import type { ReactNode } from "react";
import { type SearchParams } from "nuqs/server";

/**
 * Параметры для страниц репозитория
 */
export type RepoPageParams = {
  name: string;
  owner: string;
};

/**
 * Пропсы для Page
 */
export type PageProps<TParams = Record<string, string>> = {
  params: Promise<TParams>;
  searchParams: Promise<SearchParams>;
};

/**
 * Пропсы для Layout
 */
export type LayoutProps<TParams = Record<string, string>> = {
  children: ReactNode;
  params: Promise<TParams>;
};

export type RepoPageProps = PageProps<RepoPageParams>;
export type RepoLayoutProps = LayoutProps<RepoPageParams>;
