"use client";
import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn("flex flex-col gap-3", className)} {...props} />;
}
function TabsList({ className, variant = "pill", ...props }: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: "pill" | "line" }) {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        "group/tabs inline-flex w-fit items-center",
        variant === "pill" ? "h-8 rounded-md border border-border bg-muted p-0.5" : "h-9 gap-5 border-b border-border w-full justify-start",
        className
      )}
      {...props}
    />
  );
}
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-muted-foreground transition-colors outline-none disabled:opacity-50 cursor-pointer [&_svg]:size-3.5 hover:text-foreground",
        "group-data-[variant=pill]/tabs:h-full group-data-[variant=pill]/tabs:rounded-[5px] group-data-[variant=pill]/tabs:px-2.5 group-data-[variant=pill]/tabs:data-[state=active]:bg-card group-data-[variant=pill]/tabs:data-[state=active]:text-foreground group-data-[variant=pill]/tabs:data-[state=active]:shadow-soft",
        "group-data-[variant=line]/tabs:h-full group-data-[variant=line]/tabs:-mb-px group-data-[variant=line]/tabs:border-b-2 group-data-[variant=line]/tabs:border-transparent group-data-[variant=line]/tabs:data-[state=active]:border-primary group-data-[variant=line]/tabs:data-[state=active]:text-foreground",
        className
      )}
      {...props}
    />
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("flex-1 outline-none", className)} {...props} />;
}
export { Tabs, TabsList, TabsTrigger, TabsContent };
