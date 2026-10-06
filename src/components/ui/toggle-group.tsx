"use client";
import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/utils";

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn("inline-flex h-8 items-center rounded-md border border-border bg-muted p-0.5", className)}
      {...props}
    />
  );
}
function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "inline-flex h-full cursor-pointer items-center justify-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-soft [&_svg]:size-3.5",
        className
      )}
      {...props}
    />
  );
}
export { ToggleGroup, ToggleGroupItem };
