import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Doxynix - Code Analysis Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const fontData = await fetch(
    new URL(
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf",
      import.meta.url
    )
  ).then((res) => {
    if (!res.ok) throw new Error("Failed to load font");
    return res.arrayBuffer();
  });

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#030712",
        backgroundImage:
          "radial-gradient(circle at 25px 25px, #333 2%, transparent 0%), radial-gradient(circle at 75px 75px, #333 2%, transparent 0%)",
        backgroundSize: "100px 100px",
        fontFamily: '"Inter"',
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 60px",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          background: "rgba(0,0,0,0.5)",
          boxShadow: "0 0 80px -20px rgba(34, 197, 94, 0.5)",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            background: "#22c55e",
            borderRadius: "50%",
            marginRight: 24,
          }}
        />
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            color: "white",
            lineHeight: 1,
          }}
        >
          Doxynix
        </div>
      </div>

      <div
        style={{
          marginTop: 40,
          fontSize: 32,
          color: "#9ca3af",
          textAlign: "center",
          maxWidth: "800px",
        }}
      >
        Smart Documentation & Metrics for your Code
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
