import { cn } from "@/lib/utils";

const palette = [
  "from-sky-200/85 to-sky-100/55 text-sky-950",
  "from-amber-200/85 to-orange-100/55 text-orange-950",
  "from-emerald-200/85 to-emerald-100/55 text-emerald-950",
  "from-rose-200/85 to-pink-100/55 text-rose-950",
  "from-violet-200/85 to-indigo-100/55 text-violet-950",
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const tone =
    palette[
      name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) %
        palette.length
    ];

  return (
    <div
      className={cn(
        "flex size-12 items-center justify-center rounded-2xl border border-white/80 bg-gradient-to-br text-sm font-semibold shadow-[0_10px_24px_rgba(15,23,42,0.08)]",
        tone,
        className
      )}
    >
      {initials(name)}
    </div>
  );
}
