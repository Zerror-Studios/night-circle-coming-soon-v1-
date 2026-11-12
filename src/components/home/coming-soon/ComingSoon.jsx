import { cinzel } from "@/lib/fonts";

/**
 * "COMING SOON" in pale silver Cinzel capitals.
 * Static text — it appears together with the sign-up form (animated by its parent in Hero).
 */
export default function ComingSoon({
  text = "COMING SOON",
  fontSize = "clamp(12px, 1.05vw, 16px)", // text size
  gap = 20, // px of space below the text
}) {
  return (
    // wrapper carries the shadow (text-shadow would paint over gradient text)
    <div style={{ marginBottom: gap, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}>
      <p
        className={cinzel.className}
        style={{
          margin: 0,
          fontSize,
          fontWeight: 400,
          letterSpacing: "0.22em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          textAlign: "center",
          textTransform: "uppercase",
          // pale silver, slightly darker toward the bottom
          backgroundImage: "linear-gradient(180deg, #e6e4df 0%, #c2c0ba 48%, #8f8d88 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          WebkitTextFillColor: "transparent",
          paddingLeft: "0.22em", // optically re-centre (tracking adds space on the right)
        }}
      >
        {text}
      </p>
    </div>
  );
}
