export function isContentPreviewEnabled(
  env: Readonly<{ NODE_ENV?: string; CONTENT_PREVIEW?: string }> = process.env,
): boolean {
  return env.NODE_ENV === "development" && env.CONTENT_PREVIEW === "1";
}
