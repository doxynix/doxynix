"use client";

import { Package } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppBadge } from "@/shared/ui/core/badge";
import { Card, CardTitle } from "@/shared/ui/core/card";
import { GitHubIcon } from "@/shared/ui/icons/github-icon";
import { AppAvatar } from "@/shared/ui/kit/app-avatar";
import { ExternalLink } from "@/shared/ui/kit/external-link";

import type { AuthorGroup } from "../model/high-five.types";

type Props = { group: AuthorGroup };

export function HighFiveCard({ group }: Readonly<Props>) {
  const { author, authorLink, avatar, packages } = group;
  const t = useTranslations("Dashboard");

  const uniqueLicenses = Array.from(new Set(packages.map((p) => p.license)));

  return (
    <Card className="px-6 py-5">
      <div className="flex items-start gap-3">
        <AppAvatar
          alt={author}
          fallbackText={author}
          sizeClassName="size-10 sm:size-12"
          src={avatar}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle
                className="truncate text-base"
                title={author}
              >
                {author}
              </CardTitle>

              <div className="mt-1 flex flex-wrap gap-1.5">
                {uniqueLicenses.map((lic) => (
                  <AppBadge
                    key={lic}
                    variant="secondary"
                  >
                    {lic}
                  </AppBadge>
                ))}
              </div>
            </div>

            <ExternalLink
              className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
              href={authorLink}
            >
              {t("view")}
              <GitHubIcon className="size-3.5" />
            </ExternalLink>
          </div>

          <p className="mt-3 text-muted-foreground text-xs">
            {t("package_count", { count: packages.length })}
          </p>

          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {packages.map((pkg) => (
              <AppBadge
                className="max-w-full"
                key={pkg.name}
                variant="outline"
              >
                <Package className="text-muted-foreground" />
                <span className="break-all">
                  {pkg.name.includes("/") ? (
                    <>
                      <span className="text-muted-foreground">{`${pkg.name.split("/")[0]}/`}</span>
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
      </div>
    </Card>
  );
}
