import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";

const parser = unified().use(remarkParse).use(remarkGfm);

export function isSafeContentUrl(url: string, image = false): boolean {
  if (
    [...url].some(
      (char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127 || char === "\\",
    ) ||
    url.startsWith("//")
  )
    return false;
  if (url.startsWith("/") || (!image && url.startsWith("#"))) return true;
  try {
    const parsed = new URL(url);
    return (
      !parsed.username &&
      !parsed.password &&
      (image
        ? parsed.protocol === "https:"
        : ["https:", "http:", "mailto:"].includes(parsed.protocol))
    );
  } catch {
    return false;
  }
}

/** Markdown only. Code examples remain literal, never executable MDX. */
export function validateMarkdown(body: string): void {
  if (body.length > 200_000) throw new Error("正文不能超过 200000 字符");
  const tree = parser.parse(body);
  visit(tree, (node) => {
    if (node.type === "html") throw new Error("正文不支持 HTML 或 JSX，请使用 Markdown");
    if (
      node.type === "text" &&
      (/^\s*(?:import|export)\s/m.test(node.value) || /\{[^\n]*\}/.test(node.value))
    )
      throw new Error("正文不支持 MDX 导入或表达式；代码示例请放入代码块");
    if (
      (node.type === "link" || node.type === "definition" || node.type === "image") &&
      !isSafeContentUrl(node.url, node.type === "image")
    )
      throw new Error("正文包含不安全的链接或图片地址");
  });
  // Reference images use the same restrictions as inline images.
  const definitions = new Map<string, string>();
  visit(tree, "definition", (node) => {
    definitions.set(node.identifier.toLowerCase(), node.url);
  });
  visit(tree, "imageReference", (node) => {
    const url = definitions.get(node.identifier.toLowerCase());
    if (url && !isSafeContentUrl(url, true)) throw new Error("图片只允许站内绝对路径或 HTTPS 地址");
  });
}
