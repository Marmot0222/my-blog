import assert from "node:assert/strict";
import test from "node:test";
import { validateMarkdown } from "./markdown";

test("Markdown rejects executable syntax and unsafe decoded destinations", () => {
  for (const body of [
    "<script>alert(1)</script>",
    "<Widget />",
    "{process.env.KEY}",
    "import X from './x'",
    "[click](javascript:alert%281%29)",
    "[x](java&#x73;cript:alert)",
    "![x](http://example.com/a.png)",
    "![x][a]\n\n[a]: http://example.com/x",
    "[x](//evil.example/x)",
  ])
    assert.throws(() => validateMarkdown(body), body);
});
test("code, tables, safe links and existing image paths remain literal Markdown", () => {
  for (const body of [
    "```tsx\nconst x = { title: 'x' };\n<Widget />\n```",
    "`{window.alert(1)}`",
    "# Heading\n\n|a|b|\n|-|-|\n|1|2|",
    "[post](/posts/hello) ![cover](https://example.com/a.png)",
    "![cover](/images/cover.png)",
  ])
    assert.doesNotThrow(() => validateMarkdown(body));
});
