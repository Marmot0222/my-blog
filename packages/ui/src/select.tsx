"use client";

// SCSS adaptation of shadcn/ui new-york-v4/select. See ../UPSTREAM.md.
import { useContext, type ComponentProps } from "react";
import { ModalLayer } from "./layer";
import * as Primitive from "@radix-ui/react-select";
import { Icon } from "./icon";
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
      <Primitive.Icon aria-hidden="true">
        <Icon name="down" />
      </Primitive.Icon>
    </Primitive.Trigger>
  );
}
export function SelectContent({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  const modal = useContext(ModalLayer);
  return (
    <Primitive.Portal>
      <Primitive.Content
        style={{ zIndex: modal ? "var(--z-modal-menu)" : "var(--z-menu)" }}
        data-slot="select-content"
        position="popper"
        sideOffset={5}
        className={`${styles.selectContent} ${className}`}
        {...props}
      >
        <Primitive.ScrollUpButton className={styles.scrollButton}>
          <Icon name="up" />
        </Primitive.ScrollUpButton>
        <Primitive.Viewport data-scroll-area className={styles.viewport}>
          {children}
        </Primitive.Viewport>
        <Primitive.ScrollDownButton className={styles.scrollButton}>
          <Icon name="down" />
        </Primitive.ScrollDownButton>
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
      <Primitive.ItemIndicator className={styles.indicator}>
        <Icon name="check" />
      </Primitive.ItemIndicator>
    </Primitive.Item>
  );
}
