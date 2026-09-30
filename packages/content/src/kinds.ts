export const postKinds = ["article", "note", "journal"] as const;
export type PostKind = (typeof postKinds)[number];
export const postKindLabels: Record<PostKind, string> = {
  article: "文章",
  note: "笔记",
  journal: "随记",
};
export function isPostKind(value: unknown): value is PostKind {
  return typeof value === "string" && postKinds.some((kind) => kind === value);
}
