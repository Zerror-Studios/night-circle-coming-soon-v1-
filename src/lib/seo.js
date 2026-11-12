import { siteConfig, siteRoutes } from "@/config/site";
import { absoluteUrl, normalizePath } from "@/utils/url";

// Share image, favicon and app icons come from Next.js file conventions in src/app
// (opengraph-image.jsx, icon.svg, apple-icon.jsx) — Next adds their tags automatically.
// The share image is also referenced explicitly below, because a page that sets its own
// openGraph/twitter fields would otherwise lose the image from the root.
const SHARE_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: siteConfig.title, type: "image/png" };

export function getPageSeo(path = "/") {
  const normalizedPath = normalizePath(path);
  return (
    siteRoutes.find((route) => route.path === normalizedPath) || {
      path: normalizedPath,
      title: siteConfig.name,
      description: siteConfig.description,
      priority: 0.5,
      index: true,
    }
  );
}

export function createMetadata({
  title,
  description = siteConfig.description,
  path = "/",
  keywords = siteConfig.keywords,
  type = "website",
  noIndex = false,
} = {}) {
  const url = absoluteUrl(path);
  const isHome = normalizePath(path) === "/";
  // home: the full title as-is · other pages: "About | Night Circle" (template in createRootMetadata)
  const fullTitle = isHome || !title ? siteConfig.title : `${title} | ${siteConfig.name}`;

  return {
    metadataBase: new URL(siteConfig.url),
    title: isHome || !title ? { absolute: siteConfig.title } : title,
    description,
    keywords,
    applicationName: siteConfig.name,
    authors: [{ name: siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    alternates: {
      canonical: url,
    },
    openGraph: {
      type,
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      title: fullTitle,
      description,
      url,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [SHARE_IMAGE],
    },
  };
}

export function createRootMetadata() {
  return {
    ...createMetadata(),
    title: {
      default: siteConfig.title,
      template: `%s | ${siteConfig.name}`,
    },
    appleWebApp: {
      title: siteConfig.name,
      statusBarStyle: "black-translucent",
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export function createPageMetadata(path) {
  const page = getPageSeo(path);

  return createMetadata({
    title: page.title,
    description: page.description,
    path: page.path,
    noIndex: page.index === false,
  });
}

// Structured data (schema.org) for the home page: tells search engines the site's name
// and who runs it. Social profiles in siteConfig.socials are linked when filled in.
export function createSiteJsonLd() {
  const url = absoluteUrl("/");
  const sameAs = Object.values(siteConfig.socials).filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        url,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: siteConfig.language,
        publisher: { "@id": `${url}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${url}/#organization`,
        name: siteConfig.name,
        url,
        ...(sameAs.length ? { sameAs } : {}),
      },
    ],
  };
}
