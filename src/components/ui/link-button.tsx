import * as React from "react";
import { cn } from "@/lib/utils";

const arrowAlignClass = {
  top: "self-start",
  center: "self-center",
  bottom: "self-end",
} as const;

interface LinkButtonProps extends React.ComponentProps<"button"> {
  arrowPlacement?: keyof typeof arrowAlignClass;
}

function LinkButton({ className, children, arrowPlacement = "center", ...props }: LinkButtonProps) {
  return (
    <button
      type="button"
      className={cn("group flex items-center w-full text-left", className)}
      {...props}
    >
      {children}
      <span
        className={cn(
          "opacity-0 group-hover:opacity-100 text-muted-foreground shrink-0 transition-opacity text-xs",
          arrowAlignClass[arrowPlacement],
        )}
        aria-hidden="true"
      >
        →
      </span>
    </button>
  );
}

function NavLabel({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("underline underline-offset-2", className)} {...props} />;
}

export { LinkButton, NavLabel };
