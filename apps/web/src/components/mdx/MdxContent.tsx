import rehypeShiki from "@shikijs/rehype";
import { validateMarkdown } from "@ting-lab/content";
import GithubSlugger from "github-slugger";
import type { Heading, Root as MdastRoot } from "mdast";
import { toString } from "mdast-util-to-string";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import type { ShikiTransformer } from "shiki";
import { visit } from "unist-util-visit";

import { mdxComponents } from "./mdx-components";
import { mediaRequest, assetSchema } from "@ting-lab/media/client";
import { managedMediaIds } from "@ting-lab/content";
import styles from "./MdxContent.module.scss";

export type TocHeading = Readonly<{
  id: string;
  text: string;
  level: 2 | 3;
}>;

function createHeadingCollector(headings: TocHeading[]) {
  return function remarkHeadingCollector() {
    return function transform(tree: MdastRoot): void {
      const slugger = new GithubSlugger();

      visit(tree, "heading", (node: Heading) => {
        if (node.depth !== 2 && node.depth !== 3) {
          return;
        }

        const text = toString(node);
        const id = slugger.slug(text);
        node.data ??= {};
        node.data.hProperties = { ...node.data.hProperties, id };
        headings.push({ id, text, level: node.depth });
      });
    };
  };
}

const languageLabelTransformer: ShikiTransformer = {
  name: "ting-lab-language-label",
  pre(node) {
    node.properties["data-language"] = this.options.lang;
    node.properties["data-code"] = this.source;
  },
};

export async function compileMdxContent(source: string) {
  const started = performance.now();
  validateMarkdown(source);
  const validated = performance.now();
  const headings: TocHeading[] = [];
  const dimensions = new Map<string, { width: number; height: number }>();
  const mediaDeadline = AbortSignal.timeout(5000);
  for (const id of managedMediaIds(source)) {
    if (mediaDeadline.aborted) break;
    try {
      const response = await mediaRequest(`/assets/${id}`, { signal: mediaDeadline });
      if (response.ok) {
        const asset = assetSchema.parse(await response.json());
        dimensions.set(`/media/${id}`, { width: asset.width, height: asset.height });
      }
    } catch {
      /* Reading text remains available when media is down. */
    }
  }
  function remarkImages() {
    return (tree: MdastRoot) => {
      let index = 0;
      const definitions = new Map<string, { url: string; title?: string | null }>();
      visit(tree, "definition", (node) => {
        if (!definitions.has(node.identifier.toLowerCase()))
          definitions.set(node.identifier.toLowerCase(), node);
      });
      visit(tree, "imageReference", (node, position, parent) => {
        const definition = definitions.get(node.identifier.toLowerCase());
        if (definition && parent && typeof position === "number")
          parent.children[position] = {
            type: "image",
            url: definition.url,
            title: definition.title,
            alt: node.alt,
            position: node.position,
          };
      });
      visit(tree, "image", (node, _position, parent) => {
        node.data ??= {};
        node.data.hProperties = {
          ...node.data.hProperties,
          ...dimensions.get(node.url),
          loading: index++ === 0 ? "eager" : "lazy",
          "data-linked": parent?.type === "link" || parent?.type === "linkReference",
        };
      });
    };
  }
  const { content } = await compileMDX({
    source,
    components: mdxComponents,
    options: {
      mdxOptions: {
        format: "md",
        remarkPlugins: [remarkGfm, createHeadingCollector(headings), remarkImages],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeShiki,
            {
              themes: { light: "github-light-default", dark: "github-dark-default" },
              defaultColor: false,
              // Reuse Shiki's resource singleton, loading only encountered grammars.
              // No rendered content or publication state is cached here.
              langs: [],
              lazy: true,
              fallbackLanguage: "text",
              transformers: [languageLabelTransformer],
            },
          ],
        ],
      },
    },
  });

  if (process.env.CONTENT_TIMING === "1")
    console.info(
      JSON.stringify({
        event: "content-timing",
        stage: "markdown",
        validateMs: validated - started,
        compileMs: performance.now() - validated,
      }),
    );

  return {
    content: <div className={styles.content}>{content}</div>,
    headings,
  };
}

export const compilePostMdx = compileMdxContent;
