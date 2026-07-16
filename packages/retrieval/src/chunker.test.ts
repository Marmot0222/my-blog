import assert from "node:assert/strict";
import test from "node:test";

import { chunkMarkdown } from "./chunker";

test("按 H2/H3 稳定分块并处理同名 anchor", () => {
  const source = `开场。\n\n## 安装\n\n第一段。\n\n### 安装\n\n第二段。\n\n## 安装\n\n第三段。`;
  const first = chunkMarkdown({ title: "指南", content: source });
  const second = chunkMarkdown({ title: "指南", content: source });
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.filter((chunk) => chunk.anchor).map((chunk) => chunk.anchor),
    ["安装", "安装-1", "安装-2"],
  );
});

test("代码块保持为不可拆分原子", () => {
  const code = `\`\`\`ts\n${"const value = 1;\n".repeat(240)}\`\`\``;
  const chunks = chunkMarkdown({ title: "代码", content: `## 示例\n\n${code}` });
  assert.equal(chunks.length, 1);
  assert.ok(chunks[0]?.content.includes(code));
});

test("超长 section 会稳定拆分且不产生空 chunk", () => {
  const paragraphs = Array.from(
    { length: 20 },
    (_, index) => `第 ${index} 段。${"内容".repeat(180)}`,
  ).join("\n\n");
  const chunks = chunkMarkdown({ title: "长文", content: `## 章节\n\n${paragraphs}` });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.content.trim().length > 0));
  assert.deepEqual(
    chunks.map((chunk) => chunk.chunkIndex),
    chunks.map((_, index) => index),
  );
});
