"use client";

import { useRef, useState } from "react";
import { cinzel, cormorant } from "@/lib/fonts";
import SignupFrame, { FRAME } from "./SignupFrame";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Right edge of the SIGN UP section: just inside the right-hand scroll column
const SIGNUP_RIGHT = 559;

// Hover colours, sampled from the reference
const HOVER_BG = "#666666";
const HOVER_TEXT = "#ffffff";

// percentage helpers on the 587 × 95 design grid
const px = (v) => `${(v / FRAME.W) * 100}%`;
const py = (v) => `${(v / FRAME.H) * 100}%`;

export default function SignupForm({
  placeholder = "EMAIL",
  button = "SIGN UP",
  successText = "THANK YOU",
  errorText = "PLEASE TRY AGAIN",
  invalidText = "ENTER A VALID EMAIL",
  endpoint = "", // POST { email } here (JSON). Empty = not connected yet.
  width = 587, // px, box size at full size (scales down on small screens)
  textWidth = width, // EMAIL / SIGN UP are sized as for a box this wide (lets the box shrink while the text stays put)
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | invalid | loading | success | error
  const formRef = useRef(null);
  // fixed ids: useId() differed between server and client here (the R3F <Canvas>
  // renders a different tree on each side), which caused a hydration mismatch
  const inputId = "nc-signup-email";
  const statusId = "nc-signup-status";

  // the frame scales from one width; the text from its own (textWidth), so a smaller box keeps the same text size
  const W = `min(${width}px, 92vw)`;
  const TW = `min(${textWidth}px, 92vw)`;
  const unit = (n) => `calc(${TW} * ${n / FRAME.W})`; // n design-px → real px (text sizes)

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status === "loading" || status === "success") return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("invalid");
      // small horizontal shake so the error is visible even with text in the field
      formRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-5px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(-2px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 380, easing: "ease-out" }
      );
      return;
    }
    setStatus("loading");
    try {
      if (endpoint) {
        const website = formRef.current?.elements?.website?.value || ""; // honeypot (bots fill it)
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value, website }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } else if (process.env.NODE_ENV !== "production") {
        console.warn("[SignupForm] No `endpoint` set in marble/config.js — email was not sent anywhere.");
      }
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  const message =
    status === "success" ? successText : status === "invalid" ? invalidText : status === "error" ? errorText : "";

  const textStyle = {
    fontWeight: 500, // Cinzel Medium ≈ Trajan's stroke weight
    color: "#c3c1ba",
    textShadow: "0 1px 2px rgba(0,0,0,0.85)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className={`${cinzel.className} relative select-none`}
      style={{ width: W, aspectRatio: `${FRAME.W} / ${FRAME.H}` }}
      aria-describedby={statusId}
    >
      {/* Gray hover fill for the SIGN UP section — sits UNDER the frame so the
          bars, divider and corner ornaments stay drawn on top of it */}
      <div
        aria-hidden="true"
        className="nc-signup-fill pointer-events-none absolute"
        style={{
          left: px(FRAME.divider + 0.9),
          width: px(SIGNUP_RIGHT - FRAME.divider - 0.9),
          top: py(FRAME.top + 1.3),
          height: py(FRAME.bottom - FRAME.top - 2.6),
        }}
      />

      <SignupFrame className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* honeypot: hidden from people, but naive spam bots fill it in → server ignores those */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />

      {/* EMAIL field — fills the left section of the frame */}
      <label htmlFor={inputId} className="sr-only">
        Email address
      </label>
      <input
        id={inputId}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        required
        value={email}
        placeholder={message || placeholder}
        disabled={status === "loading" || status === "success"}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status !== "idle" && status !== "loading") setStatus("idle");
        }}
        aria-invalid={status === "invalid"}
        className="nc-signup-input absolute bg-transparent text-center outline-none"
        style={{
          ...textStyle,
          // typed address: elegant serif WITH lowercase, shown exactly as written
          // (Cinzel is capitals-only — it turned emails into ALL CAPS)
          fontFamily: cormorant.style.fontFamily,
          fontWeight: 500,
          textTransform: "none",
          letterSpacing: "0.03em",
          // warm tint on the typed text when it's not a valid address
          color: status === "invalid" ? "#c9a68c" : "#dcdad3",
          transition: "color .3s",
          left: px(FRAME.left + 14),
          width: px(FRAME.divider - FRAME.left - 28),
          top: py(FRAME.top + 2),
          height: py(FRAME.bottom - FRAME.top - 4),
          // ≥16px so iPhone Safari doesn't zoom the page when the field is tapped
          fontSize: `max(${unit(21)}, 17px)`,
          caretColor: "#e9e7e0",
          border: 0,
          padding: 0,
          "--nc-ph": status === "invalid" || status === "error" ? "#c9a68c" : "#c3c1ba",
        }}
      />

      {/* SIGN UP button — fills the right section */}
      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="nc-signup-btn absolute cursor-pointer bg-transparent"
        style={{
          ...textStyle,
          // hit area = the whole gray section, so hovering anywhere in it works
          left: px(FRAME.divider + 0.9),
          width: px(SIGNUP_RIGHT - FRAME.divider - 0.9),
          top: py(FRAME.top + 1.3),
          height: py(FRAME.bottom - FRAME.top - 2.6),
          fontSize: `max(${unit(14.6)}, 11px)`,
          border: 0,
          padding: 0,
        }}
      >
        {status === "loading" ? "…" : button}
      </button>

      <p id={statusId} aria-live="polite" className="sr-only">
        {message}
      </p>

      <style>{`
        /* the "EMAIL" placeholder keeps the Cinzel capitals of the design */
        .nc-signup-input::placeholder {
          color: var(--nc-ph);
          opacity: 1;
          transition: opacity .3s;
          font-family: ${cinzel.style.fontFamily};
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: max(${unit(17.6)}, 16px);
        }
        .nc-signup-input:focus::placeholder { opacity: 0.25; }
        .nc-signup-input:disabled { opacity: 1; -webkit-text-fill-color: #c3c1ba; }
        /* browser autofill: no light box, text stays silver.
           background-clip:text confines Chrome's autofill fill to the glyphs,
           where the text colour paints over it → the box becomes invisible */
        .nc-signup-input:-webkit-autofill,
        .nc-signup-input:-webkit-autofill:hover,
        .nc-signup-input:-webkit-autofill:focus,
        .nc-signup-input:autofill {
          -webkit-text-fill-color: #dcdad3 !important;
          caret-color: #e9e7e0;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          box-shadow: 0 0 0 1000px transparent inset !important;
          transition: background-color 600000s 0s, color 600000s 0s;
        }
        /* SIGN UP hover: solid gray section + bold white text (as in the reference) */
        .nc-signup-fill { background: ${HOVER_BG}; opacity: 0; transition: opacity .3s ease; }
        form:has(.nc-signup-btn:hover:not(:disabled)) .nc-signup-fill,
        form:has(.nc-signup-btn:focus-visible) .nc-signup-fill { opacity: 1; }

        .nc-signup-btn { transition: color .3s ease, text-shadow .3s ease; }
        .nc-signup-btn:hover:not(:disabled),
        .nc-signup-btn:focus-visible {
          color: ${HOVER_TEXT} !important;
          font-weight: 700 !important;
          text-shadow: none !important;
          outline: none;
        }
        .nc-signup-btn:disabled { cursor: default; }
      `}</style>
    </form>
  );
}
