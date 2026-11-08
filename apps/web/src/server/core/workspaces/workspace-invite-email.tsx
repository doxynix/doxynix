import { Body, Button, Container, Head, Html, Section, Text } from "react-email";

type Props = {
  body: string;
  button: string;
  expires: string;
  heading: string;
  host: string;
  ignore: string;
  preview: string;
  url: string;
};

// Mirrors the auth email shell so both transactional emails share one visual language.
export function WorkspaceInviteEmail({
  body,
  button,
  expires,
  heading,
  host,
  ignore,
  preview,
  url,
}: Readonly<Props>) {
  return (
    <Html>
      <Head />
      <Body style={{ background: "#ffffff", padding: "24px 0" }}>
        <Text style={{ color: "transparent", display: "none", height: 0, overflow: "hidden" }}>
          {preview}
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
            <Text style={{ fontSize: 20, fontWeight: 600, lineHeight: "1.4", margin: "0 0 14px" }}>
              {heading}
            </Text>

            <Text style={{ fontSize: 15, lineHeight: "1.6", margin: "0 0 14px" }}>{body}</Text>

            <Button
              href={url}
              style={{
                background: "#000000",
                borderRadius: 8,
                color: "#ffffff",
                display: "inline-block",
                fontWeight: 600,
                margin: "0 0 18px",
                padding: "12px 24px",
                textDecoration: "none",
              }}
            >
              {button}
            </Button>

            <Text style={{ fontSize: 13, lineHeight: "1.6", margin: "0 0 10px" }}>{expires}</Text>

            <Text style={{ fontSize: 13, margin: "0 0 24px", wordBreak: "break-all" }}>{url}</Text>

            <Text style={{ color: "#888888", fontSize: 12, lineHeight: "1.6", margin: 0 }}>
              {ignore}
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
