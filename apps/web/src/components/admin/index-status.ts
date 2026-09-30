const labels: Readonly<Record<string, string>> = {
  pending: "等待索引",
  running: "正在索引",
  succeeded: "处理完成",
  failed: "索引失败",
};

export function indexStatusLabel(status?: string) {
  return status ? (labels[status] ?? "状态未知") : "未入队";
}
