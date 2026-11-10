import { createPageMetadata } from "@/lib/seo";

const ContactPage = () => {
  return (
    <>
      Contact
    </>
  );
};

export default ContactPage;

export async function generateMetadata() {
  return createPageMetadata("/contact");
}
