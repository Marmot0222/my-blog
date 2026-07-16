import GithubSlugger from "github-slugger";
import type { RootContent } from "mdast";
import { toString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import { sha256 } from "./checksum";
import type { ContentChunk } from "./types";

const TARGET_CHARS = 2_400;
const MAX_CHARS = 3_200;
const OVERLAP_CHARS = 240;

type Section = {
  heading?: string;
  anchor?: string;
  nodes: RootContent[];
};

function sourceForNode(source: string, node: RootContent): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? toString(node) : source.slice(start, end);
}

function splitLongText(value: string): string[] {
  const parts: string[] = [];
  let rest = value.trim();
  while (rest.length > MAX_CHARS) {
    const range = rest.slice(0, MAX_CHARS);
    const paragraph = range.lastIndexOf("\n\n");
    const sentence = Math.max(
      range.lastIndexOf("。"),
      range.lastIndexOf("！"),
      range.lastIndexOf("？"),
    );
    const splitAt = Math.max(paragraph, sentence + 1, TARGET_CHARS);
    parts.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(Math.max(0, splitAt - OVERLAP_CHARS)).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

function sectionBodies(source: string, section: Section): string[] {
  const bodies: string[] = [];
  let current = "";
  for (const node of section.nodes) {
    const raw = sourceForNode(source, node).trim();
    if (!raw) continue;
    if (node.type === "code" && raw.length > MAX_CHARS) {
      if (current) bodies.push(current);
      bodies.push(raw);
      current = "";
      continue;
    }
    const candidates = raw.length > MAX_CHARS ? splitLongText(raw) : [raw];
    for (const candidate of candidates) {
      if (current && current.length + candidate.length + 2 > MAX_CHARS) {
        bodies.push(current);
        const overlap = current.slice(-OVERLAP_CHARS);
        current = overlap ? `${overlap}\n\n${candidate}` : candidate;
      } else {
        current = current ? `${current}\n\n${candidate}` : candidate;
      }
    }
  }
  if (current) bodies.push(current);
  return bodies;
}

export function approximateTokenCount(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

export function chunkMarkdown(input: Readonly<{ title: string; content: string }>): ContentChunk[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(input.content);
  const slugger = new GithubSlugger();
  const sections: Section[] = [{ nodes: [] }];

  for (const node of tree.children) {
    if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
      const heading = toString(node).trim();
      sections.push({ heading, anchor: slugger.slug(heading), nodes: [] });
    } else {
      sections.at(-1)?.nodes.push(node);
    }
  }

  const chunks: ContentChunk[] = [];
  for (const section of sections) {
    const prefix = section.heading
      ? `# ${input.title}\n\n## ${section.heading}`
      : `# ${input.title}`;
    for (const body of sectionBodies(input.content, section)) {
      const content = `${prefix}\n\n${body}`.trim();
      if (!content) continue;
      chunks.push({
        chunkIndex: chunks.length,
        heading: section.heading,
        anchor: section.anchor,
        content,
        contentHash: sha256(content),
        tokenCount: approximateTokenCount(content),
      });
    }
  }
  return chunks;
}
