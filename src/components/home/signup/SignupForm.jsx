"use client";

import { useEffect, useRef, useState } from "react";
import { cinzel, cormorant } from "@/lib/fonts";
import SignupFrame, { FRAME } from "./SignupFrame";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Give up waiting for the server after this long and say so (slow mobile networks).
// The server may retry the sheet once, so leave it room for that.
const TIMEOUT_MS = 25000;

// Right edge of the SIGN UP section: just inside the right-hand scroll column
const SIGNUP_RIGHT = 559;

// Hover colours, sampled from the reference
const HOVER_BG = "#666666";
const HOVER_TEXT = "#ffffff";

// warm tint used for every problem (invalid address, failed sign-up)
const WARN = "#c9a68c";

// percentage helpers on the 587 × 95 design grid
const px = (v) => `${(v / FRAME.W) * 100}%`;
const py = (v) => `${(v / FRAME.H) * 100}%`;

// what screen readers hear (the visible words are the line above the form, set in Hero)
const SR_TEXT = {
  success: "You are signed up. See you soon.",
  failed: "Sign-up failed. You are not signed up yet. Please try again.",
  offline: "No internet connection. You are not signed up yet. Please try again.",
  busy: "Too many attempts. Please wait a few minutes, then try again.",
};

export default function SignupForm({
  placeholder = "EMAIL",
  button = "SIGN UP",
  invalidText = "ENTER A VALID EMAIL",
  endpoint = "", // POST { email } here (JSON); success only when it answers { ok: true }
  onOutcome, // called with "success" | "error" after each attempt (Hero swaps COMING SOON for it)
  width = 587, // px, box size at full size (scales down on small screens)
  textWidth = width, // EMAIL / SIGN UP are sized as for a box this wide (lets the box shrink while the text stays put)
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | invalid | loading | success | error
  const [errorKind, setErrorKind] = useState("failed"); // failed | offline | busy
  const formRef = useRef(null);
  // fixed ids: useId() differed between server and client here (the R3F <Canvas>
  // renders a different tree on each side), which caused a hydration mismatch
  const inputId = "nc-signup-email";
  const statusId = "nc-signup-status";

  // the frame scales from one width; the text from its own (textWidth), so a smaller box keeps the same text size
  const W = `min(${width}px, 92vw)`;
  const TW = `min(${textWidth}px, 92vw)`;
  const unit = (n) => `calc(${TW} * ${n / FRAME.W})`; // n design-px → real px (text sizes)
  const labelSize = `max(${unit(14.6)}, 11px)`; // shared by the typed email, the EMAIL placeholder and SIGN UP

  // iPhone/iPad Safari zooms the whole page when you tap a field whose text is under 16px.
  // The email text is smaller than that (it matches SIGN UP), so stop that zoom on iOS only.
  // iOS still lets people pinch-zoom; Android never auto-zooms, so it is left untouched.
  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const meta = document.querySelector('meta[name="viewport"]');
    if (!ios || !meta || /maximum-scale/.test(meta.content)) return;
    const original = meta.content;
    meta.content = `${original}, maximum-scale=1`;
    return () => {
      meta.content = original;
    };
  }, []);

  const shake = () =>
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

  // not saved: the form stays (address still in it) so they can send it again
  const fail = (kind) => {
    setErrorKind(kind);
    setStatus("error");
    shake();
    onOutcome?.("error");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (status === "loading" || status === "success") return;
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus("invalid");
      shake();
      return;
    }
    if (!endpoint) {
      console.error("[SignupForm] No `endpoint` set in marble/config.js — the sign-up cannot be saved.");
      fail("failed");
      return;
    }
    if (navigator.onLine === false) {
      fail("offline");
      return;
    }

    setStatus("loading");
    const hp = formRef.current?.elements?.nc_hp?.value || ""; // honeypot (bots fill it)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: value, hp }),
        cache: "no-store",
        signal: controller.signal,
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        // not JSON (e.g. a Wi-Fi login page or a proxy error page) → not saved
      }
      // only a real "saved" answer from our own route counts as signed up
      if (res.ok && data?.ok === true) {
        setStatus("success"); // the form fades away
        onOutcome?.("success");
        return;
      }
      if (data?.error === "invalid_email") {
        setStatus("invalid");
        shake();
        return;
      }
      fail(res.status === 429 ? "busy" : "failed");
    } catch {
      // network error or timeout: the request may never have reached the server
      fail(navigator.onLine === false ? "offline" : "failed");
    } finally {
      clearTimeout(timer);
    }
  };

  const srMessage =
    status === "success"
      ? SR_TEXT.success
      : status === "error"
        ? SR_TEXT[errorKind]
        : status === "invalid"
          ? invalidText
          : "";
  const done = status === "success";

  const textStyle = {
    fontWeight: 500, // Cinzel Medium ≈ Trajan's stroke weight
    color: "#c3c1ba",
    textShadow: "0 1px 2px rgba(0,0,0,0.85)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };

  return (
    // fixed footprint (same size as the framed box): when the form fades away after a
    // sign-up, the line above it ("SEE YOU SOON") stays exactly where COMING SOON was
    <div
      className={`${cinzel.className} relative select-none`}
      style={{ width: W, aspectRatio: `${FRAME.W} / ${FRAME.H}` }}
    >
      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className={`absolute inset-0${done ? " nc-signup-done" : ""}`}
        inert={done}
        aria-hidden={done || undefined}
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

        {/* honeypot: hidden from people, but naive spam bots fill it in.
            Meaningless name + ignore flags so phone/browser autofill and password
            managers leave it alone (a field called "website" got autofilled). */}
        <input
          type="text"
          name="nc_hp"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore=""
          data-lpignore="true"
          data-bwignore=""
          data-form-type="other"
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
          placeholder={status === "invalid" ? invalidText : placeholder}
          readOnly={status === "loading"}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "invalid" || status === "error") setStatus("idle");
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
            color: status === "invalid" ? WARN : "#dcdad3",
            transition: "color .3s",
            left: px(FRAME.left + 14),
            width: px(FRAME.divider - FRAME.left - 28),
            top: py(FRAME.top + 2),
            height: py(FRAME.bottom - FRAME.top - 4),
            // same size as SIGN UP on every screen (iPhone tap-zoom is turned off in the effect above)
            fontSize: labelSize,
            caretColor: "#e9e7e0",
            border: 0,
            padding: 0,
            "--nc-ph": status === "invalid" ? WARN : "#c3c1ba",
          }}
        />

        {/* SIGN UP button — fills the right section */}
        <button
          type="submit"
          disabled={status === "loading" || done}
          aria-busy={status === "loading"}
          className="nc-signup-btn absolute cursor-pointer bg-transparent"
          style={{
            ...textStyle,
            // hit area = the whole gray section, so hovering anywhere in it works
            left: px(FRAME.divider + 0.9),
            width: px(SIGNUP_RIGHT - FRAME.divider - 0.9),
            top: py(FRAME.top + 1.3),
            height: py(FRAME.bottom - FRAME.top - 2.6),
            fontSize: labelSize,
            border: 0,
            padding: 0,
          }}
        >
          {status === "loading" ? "…" : button}
        </button>
      </form>

      {/* always mounted, so screen readers announce every change */}
      <p id={statusId} aria-live="polite" className="sr-only">
        {srMessage}
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
          font-size: ${labelSize};
        }
        .nc-signup-input:focus::placeholder { opacity: 0.25; }
        .nc-signup-input:read-only { -webkit-text-fill-color: #c3c1ba; }
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

        /* signed up: the form fades away (SEE YOU SOON shows above it) */
        .nc-signup-done { animation: nc-signup-out .6s ease both; pointer-events: none; }
        @keyframes nc-signup-out {
          from { opacity: 1; filter: blur(0); }
          to { opacity: 0; filter: blur(4px); visibility: hidden; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes nc-signup-out { from { opacity: 1; } to { opacity: 0; visibility: hidden; } }
        }
      `}</style>
    </div>
  );
}
