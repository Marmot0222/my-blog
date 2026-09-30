"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { postKinds, postKindLabels } from "@ting-lab/content/kinds";
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
function FilterActions({
  pageSize,
  pending,
  reset,
}: {
  pageSize: number;
  pending: boolean;
  reset: () => void;
}) {
  return (
    <div className={styles.filterActions}>
      <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
        筛选
      </Button>
      <Button asChild variant="ghost">
        <Link href={`/admin/posts?pageSize=${pageSize}`} onClick={reset}>
          清空
        </Link>
      </Button>
    </div>
  );
}
function FilterSelect({
  name,
  label,
  value,
  onChange,
  options,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div className={styles.filterField}>
      <Label htmlFor={`filter-${name}`}>{label}</Label>
      <input type="hidden" name={name} value={value} />
      <Select
        value={value ? `value:${value}` : "all"}
        onValueChange={(value) => onChange(value === "all" ? "" : value.slice(6))}
      >
        <SelectTrigger id={`filter-${name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {name !== "pageSize" && <SelectItem value="all">全部</SelectItem>}
          {options.map(([value, label]) => (
            <SelectItem key={value} value={`value:${value}`}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function AdminFilters({
  q,
  kind,
  category,
  tag,
  status,
  pageSize,
  categories,
  tags,
}: {
  q: string;
  kind: string;
  category: string;
  tag: string;
  status: string;
  pageSize: number;
  categories: string[];
  tags: string[];
}) {
  const initial = { q, kind, category, tag, status, pageSize: String(pageSize) };
  const [values, setValues] = useState<Record<string, string>>(initial);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const textOptions = (values: string[], selected: string) =>
    [...new Set([...values, ...(selected ? [selected] : [])])].map((value) => [value, value]);
  return (
    <form
      className={styles.filters}
      action="/admin/posts"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const params = new URLSearchParams(values);
        startTransition(() => router.push("/admin/posts?" + params.toString()));
      }}
    >
      <div className={styles.filterField}>
        <Label htmlFor="filter-q">标题关键词</Label>
        <Input
          id="filter-q"
          name="q"
          value={values.q}
          onChange={(event) => setValues({ ...values, q: event.target.value })}
          maxLength={120}
        />
      </div>
      {[
        {
          name: "kind",
          label: "内容形式",
          options: postKinds.map((kind) => [kind, postKindLabels[kind]]),
        },
        {
          name: "category",
          label: "分类",
          options: textOptions(categories, category),
        },
        { name: "tag", label: "标签", options: textOptions(tags, tag) },
        {
          name: "status",
          label: "状态",
          options: [
            ["published", "已发布"],
            ["draft", "草稿"],
            ["deleted", "回收站"],
          ],
        },
        {
          name: "pageSize",
          label: "每页条数",
          options: [
            ["10", "10"],
            ["20", "20"],
            ["50", "50"],
          ],
        },
      ].map((filter) => (
        <FilterSelect
          key={filter.name}
          name={filter.name}
          label={filter.label}
          options={filter.options}
          value={values[filter.name]}
          onChange={(value) => setValues({ ...values, [filter.name]: value })}
        />
      ))}
      <FilterActions
        pageSize={pageSize}
        pending={pending}
        reset={() =>
          setValues({
            q: "",
            kind: "",
            category: "",
            tag: "",
            status: "",
            pageSize: String(pageSize),
          })
        }
      />
    </form>
  );
}
