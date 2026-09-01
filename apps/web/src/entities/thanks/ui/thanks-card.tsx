"use client";

import { Package } from "lucide-react";

import { AppBadge } from "@/shared/ui/core/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import type { AuthorGroup } from "@/features/thanks/model/thanks.types";

type Props = { group: AuthorGroup };

export function ThanksCard({ group }: Readonly<Props>) {
  const { author, authorLink, avatar, packages } = group;

  const uniqueLicenses = Array.from(new Set(packages.map((p) => p.license)));

  return (
    <Card className="flex flex-col justify-between transition-standard hover:border-border-strong">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 overflow-hidden">
            <AppAvatar alt={author} fallbackText={author} sizeClassName="size-12" src={avatar} />

            <div className="flex flex-col overflow-hidden">
              <CardTitle className="truncate font-bold text-lg" title={author}>
                {author}
              </CardTitle>
              <div className="mt-1 flex gap-1.5">
                {uniqueLicenses.map((lic) => (
                  <AppBadge key={lic} variant="secondary">
                    {lic}
                  </AppBadge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex grow flex-col gap-4 pt-0">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            {packages.length} {packages.length === 1 ? "package" : "packages"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {packages.map((pkg) => (
              <AppBadge key={pkg.name} variant="outline">
                <Package className="size-3 text-muted-foreground" />
                <span className="truncate">
                  {pkg.name.includes("/") ? (
                    <>
                      <span className="text-muted-foreground">{pkg.name.split("/")[0]}/</span>
                      <span>{pkg.name.split("/")[1]}</span>
                    </>
                  ) : (
                    pkg.name
                  )}
                </span>
              </AppBadge>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t pt-4">
          <ExternalLink
            className="ml-auto flex w-fit items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
            href={authorLink}
          >
            View
            <GitHubIcon className="size-4" />
          </ExternalLink>
        </div>
      </CardContent>
    </Card>
  );
}
