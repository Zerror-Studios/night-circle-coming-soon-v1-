import { createPageMetadata } from "@/lib/seo";

const AboutPage = () => {
  return (
    <div>
      About
    </div>
  );
};

export default AboutPage;

export async function generateMetadata() {
  return createPageMetadata("/about");
}
