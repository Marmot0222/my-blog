import test from "node:test";
import assert from "node:assert/strict";
import { managedMediaIds, validateMarkdown } from "./markdown";
const id = "11111111-1111-4111-8111-111111111111";
test("managed references resolve image definitions, ignore code and external URLs", () => {
  assert.deepEqual(
    managedMediaIds(
      `![inline](/media/${id})\n![ref][photo]\n[photo]: /media/${id}\n\n\`![literal](/media/invalid)\`\n![remote](https://example.test/a.png)`,
    ),
    [id],
  );
  assert.throws(() => managedMediaIds("![invalid](/media/not-an-id)"));
  assert.deepEqual(managedMediaIds(`[link](/media/${id})`), []);
});
test("unfinished upload tokens and blob URLs cannot be persisted", () => {
  assert.throws(() => validateMarkdown(`⟦上传:${id}⟧`));
  assert.throws(() => validateMarkdown("![x](blob:local)"));
});
