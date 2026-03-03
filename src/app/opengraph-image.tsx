import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "HR Office - All-in-One HR Management Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Background pattern */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle at 20% 50%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139,92,246,0.15) 0%, transparent 50%)",
        }} />

        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 32,
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 900,
            color: "white",
          }}>
            HR
          </div>
          <span style={{ fontSize: 42, fontWeight: 800, color: "white" }}>
            HR <span style={{ color: "#60a5fa" }}>Office</span>
          </span>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: 56,
          fontWeight: 900,
          color: "white",
          textAlign: "center",
          margin: "0 0 16px 0",
          lineHeight: 1.1,
          maxWidth: 900,
        }}>
          All-in-One HR Management Platform
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 24,
          color: "rgba(199,210,254,0.8)",
          textAlign: "center",
          margin: "0 0 40px 0",
          maxWidth: 700,
        }}>
          Attendance • Tasks • Leaves • Analytics • AI Assistant
        </p>

        {/* Feature pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {["Real-time Attendance", "Face Recognition", "AI Powered", "Team Tasks"].map((f) => (
            <div key={f} style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: 100,
              padding: "8px 20px",
              color: "#93c5fd",
              fontSize: 16,
              fontWeight: 600,
            }}>
              {f}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
