import { cn } from "@/lib/utils";

export function GlassSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[22px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.72),rgba(255,255,255,0.4))] shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
        className
      )}
    />
  );
}
