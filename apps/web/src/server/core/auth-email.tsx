import { Body, Button, Container, Head, Html, Section, Text } from "@react-email/components";

export type AuthEmailKey =
  | "email_preview_text"
  | "email_confirm_sign_in"
  | "email_login_request_sent"
  | "email_click_to_complete"
  | "email_10_minutes"
  | "email_log_in_button"
  | "email_fallback_instruction"
  | "email_ignore_if_not_requested";

type EmailProps = {
  host: string;
  t: (key: AuthEmailKey) => string;
  url: string;
};

/**
 * Synchronous email template rendered via `@react-email/render`
 * (renderToStaticMarkup), which does not support async React components.
 * Localized strings are injected as a translate function from the caller so the
 * template has no dependency on the Next.js request scope (emails are sent from
 * background/plugin contexts).
 */
export function AuthEmail({ host, t, url }: Readonly<EmailProps>) {
  return (
    <Html>
      <Head />
      <Body style={{ background: "#ffffff", padding: "24px 0" }}>
        <Text style={{ color: "transparent", display: "none", height: 0, overflow: "hidden" }}>
          {t("email_preview_text")}
        </Text>
        <Section>
          <Container
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              color: "#111111",
              fontFamily:
                "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
              maxWidth: 560,
              padding: "26px 32px 10px",
              width: "100%",
            }}
          >
            {/* <Img
              src="https://postimg.cc/HcKhq62P" // logo_large.png
              alt="Doxynix"
              width={120}
              style={{ display: "block", margin: "0 auto 20px" }}
            /> */}
            <Text style={{ fontSize: 20, fontWeight: 600, lineHeight: "1.4", margin: "0 0 14px" }}>
              {t("email_confirm_sign_in")}
            </Text>

            <Text style={{ fontSize: 15, lineHeight: "1.6", margin: "0 0 14px" }}>
              {t("email_login_request_sent")}{" "}
              <span style={{ color: "#000000", fontWeight: 600 }}>{host}</span>.
            </Text>

            <Text style={{ fontSize: 15, lineHeight: "1.6", margin: "0 0 22px" }}>
              {t("email_click_to_complete")}{" "}
              <span style={{ color: "#000000", fontWeight: 700 }}>{t("email_10_minutes")}</span>.
            </Text>

            <Button
              href={url}
              style={{
                background: "#000000",
                borderRadius: 8,
                color: "#ffffff",
                display: "inline-block",
                fontWeight: 600,
                padding: "12px 24px",
                textDecoration: "none",
              }}
            >
              {t("email_log_in_button")}
            </Button>

            <Text
              style={{ color: "#555555", fontSize: 13, lineHeight: "1.6", margin: "22px 0 10px" }}
            >
              {t("email_fallback_instruction")}
            </Text>

            <Text style={{ fontSize: 13, margin: "0 0 24px", wordBreak: "break-all" }}>{url}</Text>

            <Text style={{ color: "#888888", fontSize: 12, lineHeight: "1.6", margin: 0 }}>
              {t("email_ignore_if_not_requested")}
            </Text>
          </Container>

          <Text style={{ color: "#888888", fontSize: 12, margin: "14px 0 0", textAlign: "center" }}>
            {`© 2026 Doxynix · ${host}`}
          </Text>
        </Section>
      </Body>
    </Html>
  );
}
