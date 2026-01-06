import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { owner: string; name: string } }) {
  const fontData = await fetch(
    new URL(
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf",
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
        justifyContent: "space-between",
        padding: "80px",
        backgroundColor: "#09090b",
        fontFamily: '"Inter"',
        color: "white",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 32, color: "#a1a1aa", marginBottom: 10 }}>{params.owner} /</div>
        <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.03em" }}>{params.name}</div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 16, height: 16, background: "#22c55e", borderRadius: "50%" }} />
          <div style={{ fontSize: 24, color: "#d4d4d8" }}>Analyzed by Doxynix</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "16px",
            padding: "20px 40px",
          }}
        >
          <div style={{ fontSize: 24, color: "#a1a1aa", marginRight: 20 }}>Grade</div>
          <div style={{ fontSize: 64, fontWeight: 600, color: "#22c55e" }}>A+</div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: fontData,
          style: "normal",
          weight: 600,
        },
      ],
    }
  );
}
