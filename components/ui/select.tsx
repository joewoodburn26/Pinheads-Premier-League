import * as React from "react";
import { cn } from "@/lib/utils";

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-10 rounded-md border bg-background px-3 text-sm outline-none ring-primary focus:ring-2",
        props.className
      )}
    />
  );
}
