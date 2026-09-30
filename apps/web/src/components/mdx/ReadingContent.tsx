"use client";
import type { ReactNode } from "react";
// One client entry shared by the editor and streamed Markdown. This makes the
// island module available before a Server Action returns a new preview tree.
export { CodeBlock } from "./CodeBlock";
export { ContentImage } from "./ContentImage";
export function ReadingContent({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
