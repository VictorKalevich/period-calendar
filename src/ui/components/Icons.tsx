// Inline-SVG иконки: обводка currentColor, 1.8–2 px (design.md «Скругления и размеры»).
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const TodayIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const StatsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 20V12M12 20V5M18 20v-6" />
  </Svg>
);

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h16M4 16h16" />
    <circle cx="9" cy="8" r="2.4" fill="var(--surface)" />
    <circle cx="15" cy="16" r="2.4" fill="var(--surface)" />
  </Svg>
);

export const ChevronLeft = (p: IconProps) => (
  <Svg size={20} {...p}>
    <path d="M14.5 5.5 8 12l6.5 6.5" />
  </Svg>
);

export const ChevronRight = (p: IconProps) => (
  <Svg size={20} {...p}>
    <path d="M9.5 5.5 16 12l-6.5 6.5" />
  </Svg>
);

export const DropIcon = (p: IconProps) => (
  <Svg size={20} {...p}>
    <path d="M12 3.5c3.2 4.2 6 7.6 6 10.8a6 6 0 0 1-12 0c0-3.2 2.8-6.6 6-10.8z" />
  </Svg>
);

/** Корона овуляции — точный путь из design.md, цвета через токены. */
export function Crown({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"
        fill="var(--gold)"
        stroke="var(--goldDeep)"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}
