"use client";

import type { ComponentProps } from "react";
import * as Primitive from "@radix-ui/react-radio-group";
import styles from "./controls.module.scss";

export function RadioGroup({ className = "", ...props }: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      data-slot="radio-group"
      className={`${styles.radioGroup} ${className}`}
      {...props}
    />
  );
}
// The shadcn radio primitive is presented as a segmented single-choice control.
export function RadioGroupItem({
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      data-slot="radio-group-item"
      className={`${styles.radioItem} ${className}`}
      {...props}
    />
  );
}
