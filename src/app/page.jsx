import Hero from "@/components/home/Hero";
import { createPageMetadata } from "@/lib/seo";

const HomePage = () => {
  return (
    <Hero />
  );
};

export default HomePage;

export async function generateMetadata() {
  return createPageMetadata("/");
}
