import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from "react";

const base = "w-full bg-white border border-ink-200 rounded-md px-3 text-sm text-ink-600 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:bg-ink-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(base, "h-10", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(base, "py-2 min-h-[88px]", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(base, "h-10 pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23737373%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-no-repeat bg-[right_0.6rem_center]", className)} {...props} />
  ),
);
Select.displayName = "Select";

export function Label({ className, children, htmlFor }: { className?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("text-sm font-medium text-ink-600 block mb-1.5", className)}>
      {children}
    </label>
  );
}
