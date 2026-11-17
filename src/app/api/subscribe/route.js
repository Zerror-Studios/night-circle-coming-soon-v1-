// POST /api/subscribe  { email, website? }
// 1. Appends the sign-up as a new row in the Google Sheet (service account).
// 2. Sends a "new sign-up" notification to the client's inbox via nodemailer.
// Runs on the server only — credentials never reach the browser.

import nodemailer from "nodemailer";
import { sheets as googleSheets, auth as googleAuth } from "@googleapis/sheets";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prefer server-only names; fall back to the current NEXT_PUBLIC_* names in .env.
// (Recommended: rename them without NEXT_PUBLIC_ — that prefix is meant for values
//  that may be shipped to the browser, which a password or private key must never be.)
const env = (name) => process.env[name] || process.env[`NEXT_PUBLIC_${name}`] || "";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ── simple in-memory rate limit (per server instance) ──
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const hits = new Map(); // ip -> timestamps
const recentEmails = new Map(); // email -> timestamp (ignore duplicates within the window)

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

async function appendToSheet(email, isoTime) {
  const client = getSheets();
  if (!client) throw new Error("Google Sheets is not configured");
  const tab = env("GOOGLE_SHEET_TAB");
  await client.spreadsheets.values.append({
    spreadsheetId: env("GOOGLE_SHEET_ID"),
    range: tab ? `'${tab.replace(/'/g, "''")}'!A:C` : "A:C",
    valueInputOption: "RAW", // RAW so an email like "=cmd..." is never run as a formula
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[isoTime, email, "Coming-soon page"]] },
  });
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  // honeypot: real visitors never fill this hidden field
  if (body?.website) return NextResponse.json({ ok: true });

  const email = String(body?.email || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (limited(ip)) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  // same address submitted again shortly after: accept, but don't email twice
  const seen = recentEmails.get(email);
  if (seen && Date.now() - seen < WINDOW_MS) return NextResponse.json({ ok: true });

  const now = new Date();
  const when = now.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  const safe = escapeHtml(email);

  // Run both in parallel; the sign-up counts as saved if either one succeeds.
  const [sheetResult, mailResult] = await Promise.allSettled([
    appendToSheet(email, `${when} (UTC)`),
    sendNotification(email, when, safe),
  ]);

  if (sheetResult.status === "rejected") {
    const e = sheetResult.reason;
    // log the reason, never the credentials
    console.error("[subscribe] Sheets append failed:", e?.code || "", e?.message);
  }
  if (mailResult.status === "rejected") {
    const e = mailResult.reason;
    console.error("[subscribe] sendMail failed:", e?.code || "", e?.responseCode || "", e?.message);
  }

  if (sheetResult.status === "fulfilled" || mailResult.status === "fulfilled") {
    recentEmails.set(email, Date.now());
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Could not save" }, { status: 502 });
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
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
