"use client";
import { useContext, type ComponentProps } from "react";
import { ModalLayer } from "./layer";
import * as Menu from "@radix-ui/react-dropdown-menu";
import styles from "./controls.module.scss";
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuRadioGroup = Menu.RadioGroup;
export function DropdownMenuContent({
  className = "",
  ...props
}: ComponentProps<typeof Menu.Content>) {
  const modal = useContext(ModalLayer);
  return (
    <Menu.Portal>
      <Menu.Content
        style={{ zIndex: modal ? "var(--z-modal-menu)" : "var(--z-menu)" }}
        sideOffset={6}
        collisionPadding={12}
        align="end"
        className={`${styles.menuContent} ${className}`}
        {...props}
      />
    </Menu.Portal>
  );
}
export function DropdownMenuRadioItem({
  className = "",
  ...props
}: ComponentProps<typeof Menu.RadioItem>) {
  return <Menu.RadioItem className={`${styles.selectItem} ${className}`} {...props} />;
}
