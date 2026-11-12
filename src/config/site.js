// ─────────────────────────────────────────────────────────────
// Site-wide SEO settings: name, description, domain, pages.
// ─────────────────────────────────────────────────────────────

// The live domain, used for canonical links, the sitemap and share previews
// (WhatsApp, Facebook, LinkedIn, X… can only show the banner if its URL is on the public domain).
//   1. NEXT_PUBLIC_SITE_URL, if set in the hosting environment (e.g. a custom domain)
//   2. on Vercel: the project's production domain (custom domain if one is connected)
//   3. production build anywhere else: the current live address below
//   4. local development: localhost
const LIVE_URL = "https://night-circle-coming-soon-v1.vercel.app";
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.NODE_ENV === "production" ? LIVE_URL : "http://localhost:3000");

export const siteConfig = {
  name: "Night Circle",
  title: "Night Circle — Coming Soon", // home page title in search results and share previews
  description: "Night Circle is coming soon. Sign up with your email to be the first to know when we launch.",
  url: siteUrl,
  locale: "en_IN",
  language: "en-IN",
  themeColor: "#111111", // browser UI colour on mobile (matches the page background)
  keywords: ["Night Circle", "Night Circle coming soon", "Night Circle launch"],
  contact: {
    phone: "",
    email: "",
  },
  address: {
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "IN",
  },
  // full profile URLs; filled ones are linked to the site in search results (structured data)
  socials: {
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
  },
};

// index: false → kept out of search results and the sitemap (e.g. pages that are still placeholders)
export const siteRoutes = [
  {
    path: "/",
    label: "Home",
    title: siteConfig.title,
    description: siteConfig.description,
    priority: 1,
    index: true,
  },
  {
    path: "/about",
    label: "About",
    title: "About",
    description: "About Night Circle.",
    priority: 0.8,
    index: false, // placeholder page — set to true once it has real content
  },
  {
    path: "/contact",
    label: "Contact",
    title: "Contact",
    description: "Get in touch with Night Circle.",
    priority: 0.7,
    index: false, // placeholder page — set to true once it has real content
  },
];
