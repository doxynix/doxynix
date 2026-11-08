import { createElement } from "react";
import { render } from "@react-email/render";
import { getTranslations } from "next-intl/server";
import { Resend } from "resend";

import { RESEND_API_KEY } from "@/shared/config/env.server";
import { resolveRequestLocale } from "@/shared/i18n/resolve-request-locale";
import { formatShortDate } from "@/shared/lib/date-utils";

import { appLogger } from "@/server/core/app-logger";

import { WorkspaceInviteEmail } from "./workspace-invite-email";

const resend = new Resend(RESEND_API_KEY);

type Input = {
  expiresAt: Date;
  inviterName: string;
  to: string;
  url: string;
  workspaceName: string;
};

export async function sendWorkspaceInviteEmail(input: Input): Promise<boolean> {
  try {
    const locale = await resolveRequestLocale();
    const t = await getTranslations({ locale, namespace: "Dashboard" });
    const { host } = new URL(input.url);

    const html = await render(
      createElement(WorkspaceInviteEmail, {
        body: t("invite_email_body", {
          inviter: input.inviterName,
          workspace: input.workspaceName,
        }),
        button: t("invite_email_button"),
        expires: t("invite_email_expires", {
          date: formatShortDate(input.expiresAt, locale),
        }),
        heading: t("invite_email_heading", { workspace: input.workspaceName }),
        host,
        ignore: t("invite_email_ignore"),
        preview: t("invite_email_preview", { workspace: input.workspaceName }),
        url: input.url,
      }),
    );

    await resend.emails.send({
      from: "Doxynix <invites@doxynix.space>",
      html,
      replyTo: "support@doxynix.space",
      subject: t("invite_email_subject", { workspace: input.workspaceName }),
      tags: [{ name: "category", value: "workspace_invite" }],
      to: input.to,
    });

    appLogger.info({ msg: "Workspace invite email sent", type: "workspace.invite_email_sent" });
    return true;
  } catch (error) {
    appLogger.error({
      error: error instanceof Error ? error.message : String(error),
      msg: "Failed to send workspace invite email",
      type: "workspace.invite_email_error",
    });
    return false;
  }
}
