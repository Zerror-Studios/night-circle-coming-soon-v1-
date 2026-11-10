import { siteConfig } from "@/config/site";

export function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

export function normalizePath(path = "/") {
  if (!path || path === "/") return "/";
  return `/${path}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

export function absoluteUrl(path = "/") {
  const baseUrl = trimTrailingSlash(siteConfig.url || "http://localhost:3000");
  const normalizedPath = normalizePath(path);

  return normalizedPath === "/" ? baseUrl : `${baseUrl}${normalizedPath}`;
}
