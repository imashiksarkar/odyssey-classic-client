import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

const Icon = () => {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0f172a",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        fontWeight: 700,
        fontFamily: "Inter, sans-serif",
      }}
    >
      A
    </div>,
    size,
  );
};

export default Icon;
