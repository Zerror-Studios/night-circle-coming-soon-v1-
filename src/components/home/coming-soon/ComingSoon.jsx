import { cinzel } from "@/lib/fonts";

// pale silver, slightly darker toward the bottom
const SILVER = "linear-gradient(180deg, #e6e4df 0%, #c2c0ba 48%, #8f8d88 100%)";
// same metal, warmed up — used when the line asks the visitor to try again
const WARM = "linear-gradient(180deg, #e8d5c6 0%, #c9a68c 48%, #8d735f 100%)";

/**
 * "COMING SOON" in pale silver Cinzel capitals.
 * Static text — it appears together with the sign-up form (animated by its parent in Hero).
 * After a sign-up the parent swaps the text ("SEE YOU SOON" / "TRY AGAIN"); each new
 * `swapKey` fades the new words in.
 */
export default function ComingSoon({
  text = "COMING SOON",
  fontSize = "clamp(12px, 1.05vw, 16px)", // text size
  gap = 20, // px of space below the text
  tone = "silver", // "silver" | "warm"
  swapKey = 0, // 0 = first text (no fade of its own); change it to fade in new text
}) {
  return (
    // wrapper carries the shadow (text-shadow would paint over gradient text)
    <div style={{ marginBottom: gap, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}>
      <p
        key={swapKey}
        className={`${cinzel.className}${swapKey ? " nc-swap-in" : ""}`}
        style={{
          margin: 0,
          fontSize,
          fontWeight: 400,
          letterSpacing: "0.22em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          textAlign: "center",
          textTransform: "uppercase",
          backgroundImage: tone === "warm" ? WARM : SILVER,
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
