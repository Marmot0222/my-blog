"use client";
import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import { Button } from "@ting-lab/ui";
import styles from "./Reading.module.scss";

type Props = ComponentPropsWithoutRef<"pre"> & { "data-language"?: string; "data-code"?: string };
export function CodeBlock({
  children,
  "data-language": language = "text",
  "data-code": code,
  ...props
}: Props) {
  const [status, setStatus] = useState("");
  const pre = useRef<HTMLPreElement>(null);
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeToolbar}>
        <span>{language}</span>
        <Button
          variant="ghost"
          aria-label="复制代码"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code ?? pre.current?.textContent ?? "");
              setStatus("已复制");
            } catch {
              setStatus("复制失败，请重试");
            }
          }}
        >
          复制
        </Button>
        <span role="status">{status}</span>
      </div>
      <pre ref={pre} {...props} data-language={language}>
        {children}
      </pre>
    </div>
  );
}
