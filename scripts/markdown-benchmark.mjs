import { compile } from "@mdx-js/mdx";
import shiki from "@shikijs/rehype";
import { readFileSync } from "node:fs";
const lazy = process.argv.includes("--lazy");
const source = readFileSync("content/posts/nextjs-concurrent-rendering.mdx", "utf8").replace(
  /^---[\s\S]*?---/,
  "",
);
for (let sample = 0; sample < 4; sample++) {
  const started = performance.now();
  await compile(source, {
    format: "md",
    rehypePlugins: [
      [
        shiki,
        {
          themes: { light: "github-light-default", dark: "github-dark-default" },
          defaultColor: false,
          ...(lazy ? { langs: [], lazy: true, fallbackLanguage: "text" } : {}),
        },
      ],
    ],
  });
  console.log(JSON.stringify({ lazy, sample, ms: performance.now() - started }));
}
