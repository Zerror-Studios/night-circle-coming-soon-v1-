import "../styles/globals.css";
import "../styles/fonts.css";
import SiteLayout from "@/components/common/SiteLayout";
import { createRootMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

export const experimental = {
  viewTransition: true,
};

export default function RootLayout({ children }) {
  return (
    <html lang={siteConfig.language}>
      <body suppressHydrationWarning>
        <SiteLayout>{children}</SiteLayout>
      </body>
    </html>
  );
}

export const metadata = createRootMetadata();

export const viewport = {
  themeColor: siteConfig.themeColor,
  colorScheme: "dark",
};
