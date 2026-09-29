"use client";

// SCSS adaptation of shadcn/ui new-york-v4/select. See ../UPSTREAM.md.
import type { ComponentProps } from "react";
import * as Primitive from "@radix-ui/react-select";
import styles from "./controls.module.scss";

export const Select = Primitive.Root;
export const SelectValue = Primitive.Value;
export function SelectTrigger({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      data-slot="select-trigger"
      className={`${styles.selectTrigger} ${className}`}
      {...props}
    >
      {children}
      <Primitive.Icon aria-hidden="true">⌄</Primitive.Icon>
    </Primitive.Trigger>
  );
}
export function SelectContent({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        data-slot="select-content"
        position="popper"
        sideOffset={5}
        className={`${styles.selectContent} ${className}`}
        {...props}
      >
        <Primitive.ScrollUpButton className={styles.scrollButton}>⌃</Primitive.ScrollUpButton>
        <Primitive.Viewport className={styles.viewport}>{children}</Primitive.Viewport>
        <Primitive.ScrollDownButton className={styles.scrollButton}>⌄</Primitive.ScrollDownButton>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
export function SelectItem({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      data-slot="select-item"
      className={`${styles.selectItem} ${className}`}
      {...props}
    >
      <Primitive.ItemText>{children}</Primitive.ItemText>
      <Primitive.ItemIndicator className={styles.indicator}>✓</Primitive.ItemIndicator>
    </Primitive.Item>
  );
}
