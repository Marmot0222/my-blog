"use client";

import { useTheme } from "./ThemeProvider";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { type ThemePreference } from "@/lib/theme";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@ting-lab/ui";
import styles from "./ThemeControl.module.scss";

const options: readonly { value: ThemePreference; label: string }[] = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
];

type ThemeControlProps = Readonly<{
  className: string;
  children: ReactNode;
}>;

export function ThemeControl({ className, children }: ThemeControlProps) {
  const { preference, choose } = useTheme();
  const [open, setOpen] = useState(false);
  const switching = useRef(false);
  useEffect(() => {
    const close = () => {
      switching.current = true;
      setOpen(false);
    };
    window.addEventListener("tinglab:open-search", close);
    return () => window.removeEventListener("tinglab:open-search", close);
  }, []);
  const label = options.find(({ value }) => value === preference)?.label ?? "跟随系统";

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(value) => {
        switching.current = false;
        setOpen(value);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          data-preference={preference}
          className={className}
          type="button"
          aria-label={`主题：${label}`}
        >
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-label="选择主题"
        onCloseAutoFocus={(event) => {
          if (switching.current) event.preventDefault();
        }}
      >
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => {
            if (value === "light" || value === "dark" || value === "system") choose(value);
          }}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              className={styles.option}
              value={option.value}
              key={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
