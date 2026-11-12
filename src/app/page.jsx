import Hero from "@/components/home/Hero";
import { createPageMetadata, createSiteJsonLd } from "@/lib/seo";

const HomePage = () => {
  return (
    <>
      {/* structured data: site name + organisation for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(createSiteJsonLd()).replace(/</g, "\u003c") }}
      />
      <Hero />
    </>
  );
};

export default HomePage;

export async function generateMetadata() {
  return createPageMetadata("/");
}
