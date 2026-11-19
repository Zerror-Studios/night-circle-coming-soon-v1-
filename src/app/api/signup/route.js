// POST /api/signup  { email, hp? }
// The browser only ever talks to this route (same site, same domain) — never to Google.
// 1. Appends the sign-up as a new row in the Google Sheet (service account).
//    A sign-up only counts as done once that row is written: if the sheet write fails,
//    the visitor is told so and can try again.
// 2. After the row is saved, sends a "new sign-up" notification email (does not hold up the reply).
// Runs on the server only — credentials never reach the browser.
//
// Replies: { ok: true }  or  { ok: false, error: "invalid_email" | "rate_limited" | "save_failed" | ... }

import nodemailer from "nodemailer";
import { sheets as googleSheets, auth as googleAuth } from "@googleapis/sheets";
import { NextResponse, after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Prefer server-only names; fall back to the current NEXT_PUBLIC_* names in .env.
// (Recommended: rename them without NEXT_PUBLIC_ — that prefix is meant for values
//  that may be shipped to the browser, which a password or private key must never be.)
const env = (name) => process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SOURCE = "Coming-soon page";

const noStore = { "Cache-Control": "no-store" };
const reply = (body, status = 200) => NextResponse.json(body, { status, headers: noStore });

// ── simple in-memory rate limit (per server instance) ──
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const hits = new Map(); // ip -> timestamps
const savedEmails = new Map(); // email -> time its row was written (skip duplicate rows within the window)

function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_PER_IP;
}

let transporter;
function getTransporter() {
  if (transporter) return transporter;
  const user = env("EMAIL_USER");
  const pass = env("EMAIL_PASS");
  if (!user || !pass) return null;
  const port = Number(env("EMAIL_PORT") || 465);
  transporter = nodemailer.createTransport({
    host: env("EMAIL_HOST") || "smtp.gmail.com", // the sender domain is on Google Workspace
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

// ── Google Sheets ──
// Share the sheet with GOOGLE_CLIENT_EMAIL as an Editor, or appends will 403.
// Rows are appended to the first tab (or GOOGLE_SHEET_TAB if set): Date | Email | Source
let sheetsClient;
function getSheets() {
  if (sheetsClient) return sheetsClient;
  const clientEmail = env("GOOGLE_CLIENT_EMAIL");
  // Accept the key however it was pasted: dotenv strips the surrounding quotes, but the
  // Vercel dashboard keeps them literally (→ ERR_OSSL_UNSUPPORTED). Also turn literal "\n"
  // back into newlines and drop any Windows "\r".
  const privateKey = env("GOOGLE_PRIVATE_KEY")
    .trim()
    .replace(/^(['"])([\s\S]*)\1$/, "$2")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "");
  if (!clientEmail || !privateKey || !env("GOOGLE_SHEET_ID")) return null;
  const authClient = new googleAuth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsClient = googleSheets({ version: "v4", auth: authClient });
  return sheetsClient;
}

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN", "ENOTFOUND", "EPIPE"]);

async function appendToSheet(row) {
  const client = getSheets();
  if (!client) {
    const e = new Error("Google Sheets is not configured (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY / GOOGLE_SHEET_ID)");
    e.code = "NOT_CONFIGURED";
    throw e;
  }
  const tab = env("GOOGLE_SHEET_TAB");
  const request = {
    spreadsheetId: env("GOOGLE_SHEET_ID"),
    range: tab ? `'${tab.replace(/'/g, "''")}'!A:C` : "A:C",
    valueInputOption: "RAW", // RAW so an email like "=cmd..." is never run as a formula
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  };
  // one retry for a brief Google hiccup (rate limit, 5xx, dropped connection)
  for (let attempt = 1; ; attempt++) {
    try {
      await client.spreadsheets.values.append(request, { timeout: 8000 });
      return;
    } catch (e) {
      const status = Number(e?.status || e?.response?.status || e?.code) || 0;
      const transient = TRANSIENT_STATUS.has(status) || TRANSIENT_CODES.has(e?.code);
      if (attempt >= 2 || !transient) throw e;
      await new Promise((r) => setTimeout(r, 700));
    }
  }
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return reply({ ok: false, error: "bad_request" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return reply({ ok: false, error: "invalid_email" }, 400);
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (limited(ip)) {
    return reply({ ok: false, error: "rate_limited" }, 429);
  }

  // Same address already saved a moment ago (double tap, retry after a slow reply): it is
  // in the sheet, so say so instead of adding the same row twice.
  const saved = savedEmails.get(email);
  if (saved && Date.now() - saved < WINDOW_MS) return reply({ ok: true });

  // Honeypot: a hidden field real visitors never see. Bots tend to fill it — but so can some
  // phone/browser autofill. So a filled honeypot no longer silently drops the sign-up (that
  // lost real people before): the row is still saved, just marked so it can be checked.
  const suspicious = Boolean(body?.hp || body?.website);

  const now = new Date();
  const when = now.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

  try {
    await appendToSheet([`${when} (UTC)`, email, suspicious ? `${SOURCE} (check: hidden field filled)` : SOURCE]);
  } catch (e) {
    // log the reason, never the credentials
    console.error(
      "[signup] Sheets append failed:",
      e?.code || "",
      e?.status || e?.response?.status || "",
      e?.message
    );
    return reply({ ok: false, error: "save_failed" }, 502);
  }

  savedEmails.set(email, Date.now());

  // The row is saved, so the visitor is signed up. The notification email goes out after
  // the reply (Vercel keeps the function alive for it); if it fails, the sign-up still stands.
  if (!suspicious) {
    after(async () => {
      try {
        await sendNotification(email, when, escapeHtml(email));
      } catch (e) {
        console.error("[signup] sendMail failed:", e?.code || "", e?.responseCode || "", e?.message);
      }
    });
  }

  return reply({ ok: true });
}

async function sendNotification(email, when, safe) {
  const mailer = getTransporter();
  const to = env("CLIENT_EMAIL");
  const from = env("EMAIL_USER");
  if (!mailer || !to) throw new Error("Email is not configured (EMAIL_USER / EMAIL_PASS / CLIENT_EMAIL)");

  await mailer.sendMail({
    from: `"Night Circle" <${from}>`,
    to,
    replyTo: email,
    subject: `New sign-up: ${email}`,
    text: `Someone just signed up on the Night Circle coming-soon page.\n\nEmail: ${email}\nTime: ${when} (UTC)\n`,
    html: `
      <div style="font-family:Georgia,serif;background:#111;color:#d8d6cf;padding:28px">
        <p style="margin:0 0 6px;font-size:13px;letter-spacing:.18em;color:#8f8d88">NIGHT CIRCLE</p>
        <h2 style="margin:0 0 18px;font-weight:normal;color:#ecebe5">New sign-up</h2>
        <p style="margin:0 0 6px">Email: <a href="mailto:${safe}" style="color:#ecebe5">${safe}</a></p>
        <p style="margin:0;color:#8f8d88;font-size:13px">${escapeHtml(when)} (UTC)</p>
      </div>`,
  });
}

export function GET() {
  return reply({ ok: false, error: "method_not_allowed" }, 405);
}
