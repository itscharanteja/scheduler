import type { SVGProps } from "react";

export interface SkiftIconProps extends SVGProps<SVGSVGElement> {
  className?: string;
  primaryColor?: string;
  accentColor?: string;
}

export function SkiftIcon({
  className = "h-6 w-6 text-[#C65B3B]",
  primaryColor,
  accentColor = "#F6BB86",
  ...props
}: SkiftIconProps) {
  const fill = primaryColor ?? (className.includes("text-") ? "currentColor" : "#C65B3B");

  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path d="M6 7h8v8H6zM18 7h8v8h-8zM6 19h8v8H6z" fill={fill} />
      <path d="m21.5 17 6 6-6 6-6-6 6-6Z" fill={accentColor} />
    </svg>
  );
}
