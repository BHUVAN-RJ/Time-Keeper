import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0908",
          color: "#f0b429",
          fontSize: 200,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        TK
      </div>
    ),
    { width: 512, height: 512 },
  );
}
