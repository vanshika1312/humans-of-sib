import { cn, initials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
  xl: "size-20 text-xl",
};

export function Avatar({ src, name, size = "md", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden font-semibold text-white bg-gradient-to-br from-sky-500 to-orange-500 ring-2 ring-white",
        sizeMap[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || ""} className="size-full object-cover" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}
