import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/ui/lib/cn";

const fieldClassName =
  "min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-base text-stone-950 outline-none transition-[border-color,box-shadow] duration-150 focus:border-amber-700 focus:ring-2 focus:ring-amber-200 disabled:bg-stone-100 disabled:text-stone-500";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClassName, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(fieldClassName, "min-h-24 resize-y", className)}
      {...props}
    />
  );
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="mt-1 text-sm text-red-700" role="alert">
      {children}
    </p>
  );
}
