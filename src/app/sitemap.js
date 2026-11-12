import { siteRoutes } from "@/config/site";
import { absoluteUrl } from "@/utils/url";

// only pages meant for search results (index !== false)
export default function sitemap() {
  return siteRoutes
    .filter((route) => route.index !== false)
    .map((route) => ({
      url: absoluteUrl(route.path),
      lastModified: new Date(),
      changeFrequency: route.path === "/" ? "weekly" : "monthly",
      priority: route.priority,
    }));
}
