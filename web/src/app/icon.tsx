import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 72,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        TK
      </div>
    ),
    { ...size },
  );
}
