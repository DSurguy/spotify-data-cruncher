import * as React from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const arrowAlignClass = {
  top: "self-start",
  center: "self-center",
  bottom: "self-end",
} as const;

interface LinkButtonProps {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  arrowPlacement?: keyof typeof arrowAlignClass;
  children: React.ReactNode;
}

function LinkButton({ href, className, style, children, arrowPlacement = "center" }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn("group flex items-center w-full text-left", className)}
      style={style}
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
    </Link>
  );
}

function NavLabel({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("underline underline-offset-2", className)} {...props} />;
}

export { LinkButton, NavLabel };
