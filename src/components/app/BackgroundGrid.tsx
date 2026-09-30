
export function BackgroundGrid() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ background: "#e2e8f0" }}
    >
      {/* Primary Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(51, 65, 85, 0.18) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(51, 65, 85, 0.18) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Fine Precision Grid */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(30, 41, 59, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(30, 41, 59, 0.08) 1px, transparent 1px)
          `,
          backgroundSize: "12px 12px",
        }}
      />

      {/* Major Precision Lines */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(15, 23, 42, 0.35) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(15, 23, 42, 0.35) 1px, transparent 1px)
          `,
          backgroundSize: "192px 192px",
        }}
      />

      {/* Diagonal Engineering Lines */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              135deg,
              transparent 0px,
              transparent 119px,
              rgba(15, 23, 42, 0.4) 120px,
              transparent 121px,
              transparent 240px
            )
          `,
        }}
      />

      {/* Silver Highlight Glow */}
      <div
        className="absolute rounded-full opacity-90 blur-3xl"
        style={{
          left: "-10%",
          top: "-22%",
          width: "58%",
          height: "62%",
          background:
            "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 34%, rgba(255,255,255,0) 72%)",
        }}
      />

      {/* Dark Silver Depth */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          right: "-12%",
          bottom: "-18%",
          width: "48%",
          height: "54%",
          background:
            "radial-gradient(circle, rgba(30,41,59,0.15) 0%, rgba(30,41,59,0) 72%)",
        }}
      />

      {/* Horizontal Axis */}
      <div
        className="absolute left-0 right-0 opacity-50"
        style={{
          top: "27%",
          height: "1px",
          background:
            "linear-gradient(90deg, transparent 0%, rgba(15,23,42,0.25) 18%, rgba(255,255,255,0.95) 50%, rgba(15,23,42,0.25) 82%, transparent 100%)",
        }}
      />

      {/* Vertical Axis */}
      <div
        className="absolute bottom-0 top-0 opacity-30"
        style={{
          left: "66%",
          width: "1px",
          background:
            "linear-gradient(to bottom, transparent 0%, rgba(15,23,42,0.32) 25%, rgba(255,255,255,0.75) 50%, rgba(15,23,42,0.25) 75%, transparent 100%)",
        }}
      />

      {/* Metallic Sheen Overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.8) 38%, transparent 46%, transparent 72%, rgba(255,255,255,0.45) 79%, transparent 86%)",
          backgroundSize: "220% 100%",
          animation: "lp-grid-sheen 14s ease-in-out infinite",
        }}
      />

      {/* Edge Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 42%, rgba(15,23,42,0.08) 100%)",
        }}
      />

      <style>{`
        @keyframes lp-grid-sheen {
          0% { background-position: 120% 0; }
          50% { background-position: 0% 0; }
          100% { background-position: -120% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          div { animation: none !important; }
        }
      `}</style>
    </div>
  )
}