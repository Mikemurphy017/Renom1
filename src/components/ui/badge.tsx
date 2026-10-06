import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[5px] border px-1.5 py-0.5 text-[11px] font-medium leading-none [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground bg-transparent",
        brass: "border-primary/30 bg-brass-soft text-[#7d6238] dark:text-primary",
        success: "border-success/25 bg-success-soft text-success",
        danger: "border-destructive/25 bg-warning-soft text-destructive",
        navy: "border-transparent bg-navy text-navy-foreground dark:bg-secondary",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
