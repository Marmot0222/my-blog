const LOCAL_ORIGIN = "http://localhost:3000";

export function normalizeSiteOrigin(value: string | undefined): string {
  if (!value?.trim()) return LOCAL_ORIGIN;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return LOCAL_ORIGIN;
    return url.origin;
  } catch {
    return LOCAL_ORIGIN;
  }
}

export const siteConfig = Object.freeze({
  name: "Ting Lab",
  title: "Ting Lab — 记录技术，也让知识可以被提问",
  description: "记录编码、设计、思考与实践的过程。",
  author: "Weng Tingxing",
  github: "https://github.com/Marmot0222",
  locale: "zh_CN",
  language: "zh-CN",
  origin: normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL),
});

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, `${siteConfig.origin}/`).toString();
}
