"use client";;
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@/lib/utils";

export function Label(
  {
    className,
    render,
    ...props
  }
) {
  const defaultProps = {
    // No exact "label" token in DESIGN.md; closest analog is body-sm-strong
    // (14/600/20lh), fixed at all widths.
    className: cn(
      "inline-flex items-center gap-2 font-semibold text-sm/5 text-foreground",
      className
    ),
    "data-slot": "label",
  };

  return useRender({
    defaultTagName: "label",
    props: mergeProps(defaultProps, props),
    render,
  });
}
