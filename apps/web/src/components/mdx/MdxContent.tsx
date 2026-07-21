import rehypeShiki from "@shikijs/rehype";
import GithubSlugger from "github-slugger";
import type { Heading, Root as MdastRoot } from "mdast";
import { toString } from "mdast-util-to-string";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import type { ShikiTransformer } from "shiki";
import { visit } from "unist-util-visit";

import { mdxComponents } from "./mdx-components";
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
  },
};

export async function compilePostMdx(source: string) {
  const headings: TocHeading[] = [];
  const { content } = await compileMDX({
    source,
    components: mdxComponents,
    options: {
      mdxOptions: {
        format: "md",
        remarkPlugins: [remarkGfm, createHeadingCollector(headings)],
        rehypePlugins: [
          rehypeSlug,
          [
            rehypeShiki,
            {
              themes: { light: "github-light-default", dark: "github-dark-default" },
              defaultColor: false,
              transformers: [languageLabelTransformer],
            },
          ],
        ],
      },
    },
  });

  return {
    content: <div className={styles.content}>{content}</div>,
    headings,
  };
}
