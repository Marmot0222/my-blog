import { ImageResponse } from "next/og";

export const alt = "TING LAB — Editorial technology notes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#f7f6f2",
        color: "#111214",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "72px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: "0.12em" }}>
        TING LAB
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.08 }}>
          Notes on code, systems and AI.
        </div>
        <div style={{ color: "#6f7177", display: "flex", fontSize: 28 }}>
          A personal technology blog and knowledge lab.
        </div>
      </div>
      <div style={{ background: "#164cff", display: "flex", height: 8, width: 180 }} />
    </div>,
    size,
  );
}
