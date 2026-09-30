export function uploadMarker(id: string) {
  return `⟦上传:${id}⟧`;
}
export function imageMarkdown(url: string, alt: string) {
  return `![${alt.replace(/[\\\[\]]/g, "\\$&").replace(/[\r\n]/g, " ")}](${url})`;
}
export function replaceUpload(body: string, id: string, replacement: string) {
  const marker = uploadMarker(id),
    start = body.indexOf(marker);
  if (start < 0 || body.indexOf(marker, start + marker.length) >= 0) return body;
  return body.slice(0, start) + replacement + body.slice(start + marker.length);
}
export function draftWithoutUploads(body: string) {
  return body.replace(/⟦上传:[0-9a-f-]+⟧/g, "");
}
