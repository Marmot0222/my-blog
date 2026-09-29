# A：筛选适配与交互

实际 Git 基线：`f1554a292b73dc255934d40e8e844a52e6d90220`。本轮修改尚未提交，没有编造新的 milestone commit。A 的提交边界是 ui Select/RadioGroup、PostFilters、文章页筛选、LatestNotes、上游许可证与筛选 E2E；数据库 schema 无变化。

选择 Radix/shadcn 源码结构，SCSS Modules 使用现有 token；标签稳定宽度 200px，窄屏整行，44px 触控目标，Portal 最高 20rem 可滚动。URL 决定已生效条件，待处理选择由 ref 累积，切换清 page，重置 `/posts`，历史恢复从 URL 读取。类型保持正确 radio 语义。

已运行 `pnpm exec playwright test e2e/filters.spec.ts --workers=1`：3/3 通过，包含即时选择、快速连续操作、历史与刷新、键盘/Escape、浅深主题、320/375/768/1440、200% CSS zoom 检查。这里的 200% 为自动化 CSS zoom，未宣称手机实机或浏览器工具栏缩放测试。生产 Web 构建通过。

截图：改造前 [桌面](screenshots/a-before-desktop.png)，改造后 [浅色桌面](screenshots/filters-light-1440.png)、[深色手机宽度](screenshots/filters-dark-375.png)、[320px](screenshots/filters-light-320.png)、[200%](screenshots/filters-200-percent.png)。已人工查看桌面和深色手机截图，菜单、边框和文字层级正常，无横向溢出。

依赖下载耗时约 27 分钟；等待期间按提示词的环境阻塞条款准备了独立 B 数据库代码，因此工作区包含后续里程碑，不是已经拆分的三个 Git commit。后续整体验证见 [最终验收](verification.md)。
