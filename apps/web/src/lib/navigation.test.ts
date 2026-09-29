import assert from "node:assert/strict";
import test from "node:test";
import { navItems, navigationCurrent } from "./navigation";
test("navigation matches section boundaries, tags and exact pages", () => {
  for (const item of navItems) {
    assert.equal(navigationCurrent("/", item.href), undefined);
    assert.equal(navigationCurrent("/missing", item.href), undefined);
    assert.equal(navigationCurrent(item.href, item.href), "page");
    assert.equal(navigationCurrent(`${item.href}/detail`, item.href), "location");
    assert.equal(navigationCurrent(`${item.href}-other`, item.href), undefined);
  }
  assert.equal(navigationCurrent("/tags", "/posts"), "location");
  assert.equal(navigationCurrent("/tags/react", "/posts"), "location");
  assert.equal(navigationCurrent("/tags-other", "/posts"), undefined);
});
