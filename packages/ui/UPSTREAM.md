# shadcn/ui SCSS 适配

来源：[shadcn/ui](https://github.com/shadcn-ui/ui)，固定参考提交 `3ba91b1cc83e1bbe4ab35a422ff2a694849c5048`（new-york-v4 registry）。许可证保留于 [LICENSE.shadcn.md](LICENSE.shadcn.md)。

- [Select 源码](https://github.com/shadcn-ui/ui/blob/3ba91b1cc83e1bbe4ab35a422ff2a694849c5048/apps/v4/registry/new-york-v4/ui/select.tsx)：保留 Root/Trigger/Value、Portal/Content/Viewport、滚动按钮与 ItemText/ItemIndicator 结构。
- [RadioGroup 源码](https://github.com/shadcn-ui/ui/blob/3ba91b1cc83e1bbe4ab35a422ff2a694849c5048/apps/v4/registry/new-york-v4/ui/radio-group.tsx)：使用 Radix 单选语义、方向键及 roving focus，视觉改为必须保留一项的分段单选，不使用 tabs。
- 后台按需适配 [Button](https://github.com/shadcn-ui/ui/blob/3ba91b1cc83e1bbe4ab35a422ff2a694849c5048/apps/v4/registry/new-york-v4/ui/button.tsx)、[Input](https://github.com/shadcn-ui/ui/blob/3ba91b1cc83e1bbe4ab35a422ff2a694849c5048/apps/v4/registry/new-york-v4/ui/input.tsx)、[Textarea](https://github.com/shadcn-ui/ui/blob/3ba91b1cc83e1bbe4ab35a422ff2a694849c5048/apps/v4/registry/new-york-v4/ui/textarea.tsx)、[Label](https://github.com/shadcn-ui/ui/blob/3ba91b1cc83e1bbe4ab35a422ff2a694849c5048/apps/v4/registry/new-york-v4/ui/label.tsx) 和 [Dialog](https://github.com/shadcn-ui/ui/blob/3ba91b1cc83e1bbe4ab35a422ff2a694849c5048/apps/v4/registry/new-york-v4/ui/dialog.tsx)。Button 保留 Slot/asChild，简化为三种实际使用的 variant；Input/Textarea 保留原生表单语义；Dialog 保留 Portal、Overlay、Content、Title、Description、Close 与 Radix 焦点管理。表格/Badge 暂无必要，没有扩成完整组件库。

本地差异：Tailwind、cn 和 lucide 图标替换为 SCSS Modules、语义 CSS Token 与统一 SVG 图标；按需使用 `@radix-ui/react-*` 包，不混用 Base UI；Select 默认 popper、触发器宽度、受限滚动高度与 普通菜单层级 --z-menu，模态内菜单层级 --z-modal-menu，主题从根元素继承。不引入 Tailwind reset 或第二套主题状态。具体 primitive 版本以 `package.json` 和锁文件为准。

这是本地维护的源码适配版，不支持官方 CLI 无审查覆盖升级。新增组件须继续记录来源、保留许可证并验证键盘、焦点、portal 和浅深主题。

第十二轮补充：DropdownMenu 沿用同一固定上游 registry 的 dropdown-menu.tsx 结构，使用 Radix Root/Trigger/Portal/Content/RadioGroup/RadioItem；样式沿用 SCSS Token。Sheet 是共享 Dialog 的侧边布局适配，保留相同焦点隔离和 Portal，不另造锁滚动。Dialog 的 ModalLayer 仅提供菜单层级上下文。Button 默认 type=button，asChild 用于导航且调用点不传 disabled。
