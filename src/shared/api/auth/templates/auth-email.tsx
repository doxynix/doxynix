import { Body, Button, Container, Head, Html, Section, Text } from "@react-email/components";

type EmailProps = {
  url: string;
  host: string;
};

export function AuthEmail({ url, host }: EmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ background: "#ffffff", padding: "24px 0" }}>
        <Text style={{ display: "none", color: "transparent", height: 0, overflow: "hidden" }}>
          Login link for Doxynix. Valid for 10 minutes.
        </Text>
        <Section>
          <Container
            style={{
              width: "100%",
              maxWidth: 560,
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e5e5e5",
              padding: "26px 32px 10px",
              fontFamily:
                "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
              color: "#111111",
            }}
          >
            {/* <Img
              src="https://postimg.cc/HcKhq62P" // logo_large.png
              alt="Doxynix"
              width={120}
              style={{ display: "block", margin: "0 auto 20px" }}
            /> */}
            <Text style={{ fontSize: 20, margin: "0 0 14px", fontWeight: 600, lineHeight: "1.4" }}>
              Confirm Sign In
            </Text>

            <Text style={{ fontSize: 15, margin: "0 0 14px", lineHeight: "1.6" }}>
              A login request was sent to this email{" "}
              <span style={{ fontWeight: 600, color: "#000000" }}>{host}</span>.
            </Text>

            <Text style={{ fontSize: 15, margin: "0 0 22px", lineHeight: "1.6" }}>
              Click the button below to complete your login. Link expires in{" "}
              <span style={{ fontWeight: 700, color: "#000000" }}>10 minutes</span>.
            </Text>

            <Button
              href={url}
              style={{
                background: "#000000",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: 8,
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Log in
            </Button>

            <Text
              style={{ fontSize: 13, color: "#555555", margin: "22px 0 10px", lineHeight: "1.6" }}
            >
              If the button doesn&apos;t work, copy and paste this link into your browser:
            </Text>

            <Text style={{ wordBreak: "break-all", fontSize: 13, margin: "0 0 24px" }}>{url}</Text>

            <Text style={{ fontSize: 12, color: "#888888", margin: 0, lineHeight: "1.6" }}>
              If you didn&apos;t request this, you can safely ignore this email.
            </Text>
          </Container>

          <Text style={{ color: "#888888", fontSize: 12, margin: "14px 0 0", textAlign: "center" }}>
            © 2026 Doxynix · {host}
          </Text>
        </Section>
      </Body>
    </Html>
  );
}
