import assert from "node:assert/strict";
import test from "node:test";
import { isContentPreviewEnabled } from "./content-preview";

test("预览必须同时满足开发模式和显式开关，生产始终拒绝", () => {
  assert.equal(isContentPreviewEnabled({ NODE_ENV: "development", CONTENT_PREVIEW: "1" }), true);
  for (const NODE_ENV of ["production", "test", undefined]) {
    assert.equal(isContentPreviewEnabled({ NODE_ENV, CONTENT_PREVIEW: "1" }), false);
  }
  for (const CONTENT_PREVIEW of [undefined, "0", "true"]) {
    assert.equal(isContentPreviewEnabled({ NODE_ENV: "development", CONTENT_PREVIEW }), false);
  }
});
