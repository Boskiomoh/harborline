import { ImageResponse } from "next/og";

// Same geometry as the SVG mark (64-unit grid), scaled to 180px. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const u = 180 / 64;

export default function AppleIcon() {
  const block = (x: number, y: number, w: number, h: number, color: string) => (
    <div
      style={{
        position: "absolute",
        left: x * u,
        top: y * u,
        width: w * u,
        height: h * u,
        borderRadius: (Math.min(w, h) / 2) * u,
        background: color,
      }}
    />
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: "#0E5C4C",
      }}
    >
      {block(17, 13, 8, 38, "#FAF5EC")}
      {block(39, 13, 8, 38, "#FAF5EC")}
      {block(11, 30, 42, 7, "#D4602A")}
    </div>,
    { ...size },
  );
}
