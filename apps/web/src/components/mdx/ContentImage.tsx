"use client";
import { useState, useRef, type ComponentPropsWithoutRef } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@ting-lab/ui";
import styles from "./Reading.module.scss";

type Props = ComponentPropsWithoutRef<"img"> & { "data-linked"?: boolean };
export function ContentImage({
  src,
  alt = "",
  width,
  height,
  "data-linked": linked,
  loading,
}: Props) {
  const [open, setOpen] = useState(false),
    [failed, setFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (typeof src !== "string") return null;
  const image = (
    <Image
      unoptimized
      src={src}
      alt={alt}
      width={Number(width) || 1200}
      height={Number(height) || 800}
      loading={loading ?? "lazy"}
      onError={() => setFailed(true)}
      className={styles.image}
    />
  );
  return (
    <span className={styles.imageContainer}>
      {failed ? (
        <span role="status" className={styles.imageFailure}>
          图片无法显示{alt ? `：${alt}` : ""}
        </span>
      ) : linked ? (
        image
      ) : (
        <button
          ref={trigger}
          type="button"
          className={styles.imageButton}
          aria-label={`放大图片${alt ? `：${alt}` : ""}`}
          onClick={() => setOpen(true)}
        >
          {image}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={styles.lightbox}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
        >
          <DialogTitle>{alt || "图片预览"}</DialogTitle>
          <DialogDescription>按 Escape 关闭图片。</DialogDescription>
          {open && (
            <Image
              unoptimized
              src={src}
              alt={alt}
              width={Number(width) || 1200}
              height={Number(height) || 800}
              className={styles.expanded}
            />
          )}
        </DialogContent>
      </Dialog>
    </span>
  );
}
