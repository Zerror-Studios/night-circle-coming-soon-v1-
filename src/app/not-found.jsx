// Next.js also adds its own "noindex" to 404 pages; this replaces the site-wide "index, follow"
export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section>
      <h1>404 - Page Not Found</h1>
    </section>
  );
}
