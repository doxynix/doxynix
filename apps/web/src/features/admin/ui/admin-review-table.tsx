"use client";

import { useState } from "react";
import { GitPullRequest, Wrench } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import type { RouterOutput } from "@/shared/api/trpc";
import { formatShortDate } from "@/shared/lib/date-utils";
import { AppBadge } from "@/shared/ui/core/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/core/table";
import { EmptyState } from "@/shared/ui/kit/empty-state";

import { AdminReviewSheet } from "./admin-review-sheet";

type ReviewRow = RouterOutput["adminReview"]["list"]["items"][number];

type Props = {
  reviews: ReviewRow[];
};

export function AdminReviewTable({ reviews }: Readonly<Props>) {
  const t = useTranslations("AdminReview");

  if (reviews.length === 0) {
    return (
      <EmptyState
        description={t("empty_desc")}
        icon={GitPullRequest}
        title={t("empty_title")}
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("col_pull_request")}</TableHead>
          <TableHead>{t("col_status")}</TableHead>
          <TableHead>{t("col_risk")}</TableHead>
          <TableHead>{t("col_fixes")}</TableHead>
          <TableHead>{t("col_created")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviews.map((review) => (
          <AdminReviewRow
            key={review.id}
            review={review}
          />
        ))}
      </TableBody>
    </Table>
  );
}

type RowProps = {
  review: ReviewRow;
};

function AdminReviewRow({ review }: Readonly<RowProps>) {
  const t = useTranslations("AdminReview");
  const locale = useLocale();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <TableRow
      className="group cursor-pointer"
      data-testid={`review-row-${review.id}`}
      onClick={() => setSheetOpen(true)}
    >
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-sm">
            {review.owner}/{review.repoName} #{review.prNumber}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <AppBadge variant={review.status === "FAILED" ? "destructive" : "secondary"}>
          {t(`status_${review.status.toLowerCase()}`)}
        </AppBadge>
      </TableCell>

      <TableCell className="text-sm">{review.riskScore ?? t("risk_unknown")}</TableCell>

      <TableCell>
        {review.fixCount > 0 ? (
          <span className="flex items-center gap-1 text-sm">
            <Wrench className="size-3" />
            {review.fixCount}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">{t("fixes_none")}</span>
        )}
      </TableCell>

      <TableCell className="text-muted-foreground text-sm">
        {formatShortDate(review.createdAt, locale)}
      </TableCell>

      <AdminReviewSheet
        onOpenChange={setSheetOpen}
        open={sheetOpen}
        reviewId={review.id}
      />
    </TableRow>
  );
}
