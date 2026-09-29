"use client";
import { useRef, type ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ModalLayer } from "./layer";
import { Icon } from "./icon";
import styles from "./form.module.scss";

export function Button({
  asChild = false,
  variant = "default",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "default" | "outline" | "destructive" | "ghost";
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      data-slot="button"
      data-variant={variant}
      className={`${styles.button} ${className}`}
      {...props}
    />
  );
}
export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input data-slot="input" className={`${styles.input} ${className}`} {...props} />;
}
export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={`${styles.input} ${className}`} {...props} />;
}
export function Label(props: ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root data-slot="label" {...props} />;
}
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({
  children,
  className = "",
  hideClose = false,
  motion = "dialog",
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  hideClose?: boolean;
  motion?: "dialog" | "left" | "right";
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay data-slot="dialog-overlay" className={styles.overlay} />
      <DialogPrimitive.Content
        data-motion={motion}
        data-scroll-area
        className={`${styles.dialog} ${className}`}
        {...props}
        onOpenAutoFocus={(event) => {
          previousFocus.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (!event.defaultPrevented && previousFocus.current) {
            event.preventDefault();
            previousFocus.current.focus({ preventScroll: true });
          }
        }}
      >
        <ModalLayer.Provider value={true}>{children}</ModalLayer.Provider>
        {!hideClose && (
          <DialogPrimitive.Close className={styles.close} aria-label="关闭">
            <Icon name="close" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
