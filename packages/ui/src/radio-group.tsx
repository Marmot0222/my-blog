"use client";

import { createContext, useContext, useState, type ComponentProps } from "react";
import { useSelectionIndicator } from "./use-selection-indicator";
import * as Primitive from "@radix-ui/react-radio-group";
import styles from "./controls.module.scss";

const PendingChoice = createContext<string | undefined>(undefined);
export function RadioGroup({
  className = "",
  children,
  value,
  defaultValue,
  onValueChange,
  pendingValue,
  ...props
}: ComponentProps<typeof Primitive.Root> & { pendingValue?: string }) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const selected = value ?? internal;
  const { hostRef, indicatorRef } = useSelectionIndicator(selected, '[data-state="checked"]');
  return (
    <PendingChoice.Provider value={pendingValue}>
      <Primitive.Root
        ref={hostRef}
        data-slot="radio-group"
        className={`${styles.radioGroup} ${className}`}
        value={selected}
        onValueChange={(next) => {
          setInternal(next);
          onValueChange?.(next);
        }}
        {...props}
      >
        <span
          ref={indicatorRef}
          aria-hidden="true"
          data-slot="segment-indicator"
          className={styles.segmentIndicator}
        />
        {children}
      </Primitive.Root>
    </PendingChoice.Provider>
  );
}
// The shadcn radio primitive is presented as a segmented single-choice control.
export function RadioGroupItem({
  className = "",
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  const pending = useContext(PendingChoice);
  return (
    <Primitive.Item
      data-slot="radio-group-item"
      data-pending={pending === props.value || undefined}
      data-indicator-target
      className={`${styles.radioItem} ${className}`}
      {...props}
    />
  );
}
