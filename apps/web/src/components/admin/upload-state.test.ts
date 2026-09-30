import test from "node:test";
import assert from "node:assert/strict";
import { uploadMarker, replaceUpload, imageMarkdown, draftWithoutUploads } from "./upload-state";
test("late upload targets current unique anchor, preserving subsequent typing", () => {
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  const current = `before${uploadMarker(a)}typed${uploadMarker(b)}after`;
  assert.equal(replaceUpload(current, a, "image"), `beforeimagetyped${uploadMarker(b)}after`);
  assert.equal(replaceUpload("deleted and continued", a, "image"), "deleted and continued");
  assert.equal(replaceUpload(uploadMarker(a).repeat(2), a, "image"), uploadMarker(a).repeat(2));
  assert.equal(draftWithoutUploads(current), "beforetypedafter");
  assert.equal(imageMarkdown("/media/id", "a[b]\\c"), "![a\\[b\\]\\\\c](/media/id)");
});
