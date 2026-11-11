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

/** Корзина «удалить» (фича 012). */
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 3.5h4M6.5 7l.9 12.2a1.8 1.8 0 0 0 1.8 1.6h5.6a1.8 1.8 0 0 0 1.8-1.6L17.5 7M10 11v6M14 11v6" />
  </Svg>
);

/** Крестик «закрыть» (фича 010). */
export const CloseIcon = (p: IconProps) => (
  <Svg {...p} strokeWidth={2}>
    <path d="M6 6l12 12M18 6 6 18" />
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

const HEART_PATH =
  'M12 20.5s-7.6-4.7-9.2-9.5C1.6 7.4 3.8 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.4 0 5.6 3.4 4.4 7-1.6 4.8-9.2 9.5-9.2 9.5z';

/**
 * Сердечко отметки секса (фича 009, design.md): заливка `btnBg`, обводка `surface`.
 * `plain` — в кнопке: цветом текста, без обводки.
 */
export function Heart({ size = 14, className, plain = false }: { size?: number; className?: string; plain?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        d={HEART_PATH}
        fill={plain ? 'currentColor' : 'var(--btnBg)'}
        stroke={plain ? 'none' : 'var(--surface)'}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
