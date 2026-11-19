// POST /api/signup  { email, hp? }
// The browser only ever talks to this route (same site, same domain) — never to Google.
// 1. Appends the sign-up as a new row in the Google Sheet (service account).
//    A sign-up only counts as done once that row is written: if the sheet write fails,
//    the visitor is told so and can try again.
// 2. After the row is saved, sends a "new sign-up" notification email (capped at a few seconds).
// Runs on the server only — credentials never reach the browser.
//
// Replies: { ok: true }  or  { ok: false, error: "invalid_email" | "rate_limited" | "save_failed" | ... }
// A "save_failed" reply also has a short `reason` (e.g. "no_edit_access", "bad_private_key").
// GET /api/signup?check=1 tests the setup without writing anything (see the bottom of this file).

import { createPrivateKey } from "node:crypto";
import nodemailer from "nodemailer";
import { sheets as googleSheets, auth as googleAuth } from "@googleapis/sheets";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ── Settings ──
// The live site runs on AWS Amplify, which gives its console environment variables to the
// BUILD only, not to this route while it runs. So the values are also copied into the
// server code at build time (static `process.env.X` below):
//   • NEXT_PUBLIC_* names — Next.js writes their values into the code by itself
//   • the same names without NEXT_PUBLIC_ — passed through by next.config.mjs → `env`
// This file runs on the server only (an API route); never import it from browser code.
// (Recommended: name them without NEXT_PUBLIC_ — that prefix is meant for values that may
//  be shipped to the browser, which a password or private key must never be.)
const BUILD_ENV = {
  GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY || process.env.NEXT_PUBLIC_GOOGLE_PRIVATE_KEY,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID,
  GOOGLE_SHEET_TAB: process.env.GOOGLE_SHEET_TAB || process.env.NEXT_PUBLIC_GOOGLE_SHEET_TAB,
  EMAIL_USER: process.env.EMAIL_USER || process.env.NEXT_PUBLIC_EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS || process.env.NEXT_PUBLIC_EMAIL_PASS,
  EMAIL_HOST: process.env.EMAIL_HOST || process.env.NEXT_PUBLIC_EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT || process.env.NEXT_PUBLIC_EMAIL_PORT,
  CLIENT_EMAIL: process.env.CLIENT_EMAIL || process.env.NEXT_PUBLIC_CLIENT_EMAIL,
};

// A setting's value: what the running server has (local dev, Vercel), else what the build
// baked in (Amplify). Forgiving on purpose: a name saved with a stray space ("NAME " — the
// .env has some) and a value wrapped in quotes both still work.
const clean = (v) =>
  String(v || "")
    .trim()
    .replace(/^(['"])([\s\S]*)\1$/, "$2")
    .trim();
function env(name) {
  for (const n of [name, `NEXT_PUBLIC_${name}`]) {
    let v = process.env[n];
    if (!v) {
      const loose = Object.keys(process.env).find((k) => k.trim() === n);
      v = loose ? process.env[loose] : "";
    }
    if (clean(v)) return clean(v);
  }
  return clean(BUILD_ENV[name]);
}

// The sheet ID, also when the whole sheet URL was pasted instead
function sheetId() {
  const v = env("GOOGLE_SHEET_ID");
  return v.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || v;
}

// Turn the private key back into a valid PEM however it was pasted: literal "\n",
// spaces instead of line breaks, Windows "\r", quotes, the whole service-account JSON,
// or the key base64-encoded once more.
function normalizePrivateKey(raw) {
  let k = String(raw || "")
    .trim()
    .replace(/^(['"])([\s\S]*)\1$/, "$2")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .trim();
  if (k.startsWith("{")) {
    try {
      k = String(JSON.parse(k).private_key || k);
    } catch {
      // not JSON after all
    }
  }
  if (!k.includes("-----BEGIN") && /^[A-Za-z0-9+/=\s]+$/.test(k)) {
    const decoded = Buffer.from(k, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN")) k = decoded;
  }
  const pem = k.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (!pem) return k;
  const body = pem[2].replace(/\\n/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  return `-----BEGIN ${pem[1]}-----\n${(body.match(/.{1,64}/g) || []).join("\n")}\n-----END ${pem[1]}-----\n`;
}

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
// Which settings are missing (names only — never values)
function missingSheetSettings() {
  return ["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_SHEET_ID"].filter((n) => !env(n));
}

let sheetsClient;
function getSheets() {
  if (sheetsClient) return sheetsClient;
  if (missingSheetSettings().length) return null;
  const authClient = new googleAuth.GoogleAuth({
    credentials: { client_email: env("GOOGLE_CLIENT_EMAIL"), private_key: normalizePrivateKey(env("GOOGLE_PRIVATE_KEY")) },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsClient = googleSheets({ version: "v4", auth: authClient });
  return sheetsClient;
}

function notConfigured() {
  const e = new Error(`Google Sheets is not configured — missing: ${missingSheetSettings().join(", ")}`);
  e.code = "NOT_CONFIGURED";
  return e;
}

// A short, safe label for why Google refused (sent back to the browser; details go to the logs)
function failureReason(e) {
  const msg = `${e?.message || ""} ${JSON.stringify(e?.response?.data || "")}`;
  const status = Number(e?.status || e?.response?.status) || 0;
  if (e?.code === "NOT_CONFIGURED") return "not_configured";
  if (/DECODER|OSSL|PEM|asn1|routines::|private key|No key or keyFile/i.test(msg)) return "bad_private_key";
  if (/invalid_grant|invalid_client|unauthorized_client|account not found/i.test(msg)) return "key_rejected";
  if (status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) return "sheets_api_disabled";
  if (status === 403) return "no_edit_access";
  if (status === 404) return "sheet_not_found";
  if (status === 400 && /range/i.test(msg)) return "bad_tab_name";
  if (status === 429) return "google_busy";
  if (/timeout|timed out|aborted/i.test(msg) || TRANSIENT_CODES.has(e?.code)) return "timeout";
  return status ? `google_${status}` : "unknown";
}

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN", "ENOTFOUND", "EPIPE"]);

async function appendToSheet(row) {
  const client = getSheets();
  if (!client) throw notConfigured();
  const tab = env("GOOGLE_SHEET_TAB");
  const request = {
    spreadsheetId: sheetId(),
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

const EMAIL_TIMEOUT_MS = 6000;
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`timed out after ${ms}ms`), { code: "ETIMEDOUT" })), ms);
    }),
  ]).finally(() => clearTimeout(timer));
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
    const reason = failureReason(e);
    // log the reason, never the credentials
    console.error(
      "[signup] Sheets append failed:",
      reason,
      e?.code || "",
      e?.status || e?.response?.status || "",
      e?.message
    );
    // `reason` is a short label (e.g. "no_edit_access"), so a failed sign-up says what to fix
    return reply({ ok: false, error: "save_failed", reason }, 502);
  }

  savedEmails.set(email, Date.now());

  // The row is saved, so the visitor is signed up. Send the notification email BEFORE
  // replying: on Amplify the server is paused as soon as it answers, so an email sent
  // afterwards may never leave. Capped so a slow mail server can't hold the visitor up;
  // if it fails, the sign-up still stands (it is in the sheet).
  if (!suspicious) {
    try {
      await withTimeout(sendNotification(email, when, escapeHtml(email)), EMAIL_TIMEOUT_MS);
    } catch (e) {
      console.error("[signup] sendMail failed:", e?.code || "", e?.responseCode || "", e?.message);
    }
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

// GET /api/signup?check=1 — read-only health check of the live setup. Writes nothing and
// sends nothing; answers with short labels only (never a value). Use it after changing
// the Vercel environment variables to see that sign-ups can be saved.
export async function GET(req) {
  if (!new URL(req.url).searchParams.has("check")) {
    return reply({ ok: false, error: "method_not_allowed" }, 405);
  }
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  if (limited(ip)) return reply({ ok: false, error: "rate_limited" }, 429);

  const missing = missingSheetSettings();
  const checks = {
    sheetSettings: missing.length ? `missing: ${missing.join(", ")}` : "ok",
    privateKey: "not checked",
    sheetAccess: "not checked",
    notificationEmail: ["EMAIL_USER", "EMAIL_PASS", "CLIENT_EMAIL"].every((n) => env(n)) ? "ok" : "not set up",
  };

  if (!missing.length) {
    try {
      createPrivateKey(normalizePrivateKey(env("GOOGLE_PRIVATE_KEY")));
      checks.privateKey = "ok";
    } catch {
      checks.privateKey = "unreadable";
    }
  }

  if (checks.privateKey === "ok") {
    try {
      // ask Google Drive whether the service account may edit the sheet (metadata only)
      const drive = await new googleAuth.GoogleAuth({
        credentials: { client_email: env("GOOGLE_CLIENT_EMAIL"), private_key: normalizePrivateKey(env("GOOGLE_PRIVATE_KEY")) },
        scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
      }).getClient();
      const r = await drive.request({
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(sheetId())}`,
        params: { fields: "capabilities(canEdit)", supportsAllDrives: true },
        timeout: 8000,
      });
      checks.sheetAccess = r.data?.capabilities?.canEdit ? "can edit" : "view only — share the sheet as Editor";
    } catch (e) {
      // Drive API may be off for the project: fall back to reading the sheet itself
      try {
        await getSheets().spreadsheets.get({ spreadsheetId: sheetId(), fields: "spreadsheetId" }, { timeout: 8000 });
        checks.sheetAccess = "can read (edit access not confirmed)";
      } catch (e2) {
        checks.sheetAccess = failureReason(e2);
        console.error("[signup] check failed:", checks.sheetAccess, e?.message, "|", e2?.message);
      }
    }
  }

  const ok = checks.sheetSettings === "ok" && checks.privateKey === "ok" && checks.sheetAccess.startsWith("can ");
  return reply({ ok, checks }, ok ? 200 : 500);
}
