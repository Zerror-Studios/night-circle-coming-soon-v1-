// Sign-up settings for the /api/signup route (Google Sheet + notification email).
// The live site runs on AWS Amplify, which hands its console environment variables to the
// build only — the running server never sees them. Listing them under `env` makes Next.js
// write their values into the server code at build time. (NEXT_PUBLIC_* names are written
// in by Next.js on its own.) Only src/app/api/signup/route.js reads these, and it runs on the
// server, so the values never reach the browser. Names that are not set are skipped.
const SIGNUP_SETTINGS = [
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
  "GOOGLE_SHEET_TAB",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_HOST",
  "EMAIL_PORT",
  "CLIENT_EMAIL",
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  env: Object.fromEntries(SIGNUP_SETTINGS.filter((n) => process.env[n]).map((n) => [n, process.env[n]])),
};

export default nextConfig;
