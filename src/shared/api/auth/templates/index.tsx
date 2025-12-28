import { Body, Button, Container, Head, Html, Img, Section, Text } from "@react-email/components";

import type { EmailProps } from "@/shared/api/auth/templates/types";

export function AuthEmail({ url, host }: EmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ background: "#ffffff", padding: "24px 0" }}>
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
            <Img
              src="https://doxynix.space/logo_large.png
              "
              alt="Doxynix"
              width={120}
              style={{ display: "block", margin: "0 auto 20px" }}
            />
            <Text style={{ fontSize: 20, margin: "0 0 14px", fontWeight: 600, lineHeight: "1.4" }}>
              Подтверждение входа
            </Text>

            <Text style={{ fontSize: 15, margin: "0 0 14px", lineHeight: "1.6" }}>
              На этот адрес был отправлен запрос на авторизацию в <strong>{host}</strong>.
            </Text>

            <Text style={{ fontSize: 15, margin: "0 0 22px", lineHeight: "1.6" }}>
              Нажмите кнопку ниже, чтобы завершить вход. Ссылка действует ограниченное время.
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
              Войти
            </Button>

            <Text
              style={{ fontSize: 13, color: "#555555", margin: "22px 0 10px", lineHeight: "1.6" }}
            >
              Если кнопка не работает, скопируйте ссылку и вставьте в адресную строку браузера:
            </Text>

            <Text style={{ wordBreak: "break-all", fontSize: 13, margin: "0 0 24px" }}>{url}</Text>

            <Text style={{ fontSize: 12, color: "#888888", margin: 0, lineHeight: "1.6" }}>
              Если вы не запрашивали вход — просто проигнорируйте это письмо.
            </Text>
          </Container>

          <Text style={{ color: "#888888", fontSize: 12, margin: "14px 0 0" }}>© {host}</Text>
        </Section>
      </Body>
    </Html>
  );
}
