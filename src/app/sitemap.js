import { siteRoutes } from "@/config/site";
import { absoluteUrl } from "@/utils/url";

export default function sitemap() {
  return siteRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(),
    changeFrequency: route.path === "/" ? "weekly" : "monthly",
    priority: route.priority,
  }));
}
