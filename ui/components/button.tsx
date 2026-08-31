import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/ui/lib/cn";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700 disabled:pointer-events-none disabled:opacity-55 active:scale-[0.98] motion-reduce:transform-none",
  {
    variants: {
      variant: {
        primary: "bg-amber-700 text-white hover:bg-amber-800",
        secondary:
          "border border-stone-300 bg-white text-stone-900 hover:bg-stone-100",
        danger: "bg-red-700 text-white hover:bg-red-800",
        quiet: "text-stone-700 hover:bg-stone-100",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}
