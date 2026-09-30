import type { ComponentPropsWithoutRef } from "react";
import { CodeBlock, ContentImage } from "./ReadingContent";

function MdxLink({ href = "", children, ...props }: ComponentPropsWithoutRef<"a">) {
  const isExternal = /^https?:\/\//.test(href);

  return (
    <a
      {...props}
      href={href}
      rel={isExternal ? "noopener noreferrer" : undefined}
      target={isExternal ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

export const mdxComponents = {
  a: MdxLink,
  pre: CodeBlock,
  img: ContentImage,
};
