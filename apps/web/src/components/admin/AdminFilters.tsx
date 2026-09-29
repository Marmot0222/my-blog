"use client";
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@ting-lab/ui";
import Link from "next/link";
import styles from "./admin.module.scss";
export function AdminFilters({
  q,
  kind,
  status,
  pageSize,
}: {
  q: string;
  kind: string;
  status: string;
  pageSize: number;
}) {
  return (
    <form className={styles.actions} action="/admin/posts">
      <Label>
        标题关键词
        <Input name="q" defaultValue={q} maxLength={120} />
      </Label>
      {[
        {
          name: "kind",
          label: "类型",
          value: kind || "all",
          options: [
            ["all", "全部"],
            ["article", "文章"],
            ["note", "笔记"],
          ],
        },
        {
          name: "status",
          label: "状态",
          value: status || "all",
          options: [
            ["all", "全部"],
            ["published", "已发布"],
            ["draft", "草稿"],
            ["deleted", "回收站"],
          ],
        },
        {
          name: "pageSize",
          label: "每页条数",
          value: String(pageSize),
          options: [
            ["10", "10"],
            ["20", "20"],
            ["50", "50"],
          ],
        },
      ].map((filter) => (
        <div key={filter.name}>
          <Label htmlFor={`filter-${filter.name}`}>{filter.label}</Label>
          <Select name={filter.name} defaultValue={filter.value}>
            <SelectTrigger id={`filter-${filter.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <Button type="submit" variant="outline">
        筛选
      </Button>
      <Link href="/admin/posts">清空</Link>
    </form>
  );
}
