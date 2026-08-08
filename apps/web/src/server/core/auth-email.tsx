import { Body, Button, Container, Head, Html, Section, Text } from "@react-email/components";

type EmailProps = {
  host: string;
  url: string;
};

export function AuthEmail({ host, url }: Readonly<EmailProps>) {
  return (
    <Html>
      <Head />
      <Body style={{ background: "#ffffff", padding: "24px 0" }}>
        <Text style={{ color: "transparent", display: "none", height: 0, overflow: "hidden" }}>
          Login link for Doxynix. Valid for 10 minutes.
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
              Confirm Sign In
            </Text>

            <Text style={{ fontSize: 15, lineHeight: "1.6", margin: "0 0 14px" }}>
              A login request was sent to this email{" "}
              <span style={{ color: "#000000", fontWeight: 600 }}>{host}</span>.
            </Text>

            <Text style={{ fontSize: 15, lineHeight: "1.6", margin: "0 0 22px" }}>
              Click the button below to complete your login. Link expires in{" "}
              <span style={{ color: "#000000", fontWeight: 700 }}>10 minutes</span>.
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
              Log in
            </Button>

            <Text
              style={{ color: "#555555", fontSize: 13, lineHeight: "1.6", margin: "22px 0 10px" }}
            >
              If the button doesn&apos;t work, copy and paste this link into your browser:
            </Text>

            <Text style={{ fontSize: 13, margin: "0 0 24px", wordBreak: "break-all" }}>{url}</Text>

            <Text style={{ color: "#888888", fontSize: 12, lineHeight: "1.6", margin: 0 }}>
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
