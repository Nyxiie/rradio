import type { ReactNode } from 'react'

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  )
}

export const PlayIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M7 4.5v15l13-7.5z" />
  </Svg>
)
export const PauseIcon = ({ size }: { size?: number }) => (
  <Svg size={size}>
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </Svg>
)
export const PrevIcon = () => (
  <Svg>
    <path d="M6 5h2.5v14H6zM20 5v14L9.5 12z" />
  </Svg>
)
export const NextIcon = () => (
  <Svg>
    <path d="M15.5 5H18v14h-2.5zM4 5l10.5 7L4 19z" />
  </Svg>
)
export const VolumeIcon = () => (
  <Svg>
    <path d="M3 9v6h4l5 4V5L7 9zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.4 5.6a9 9 0 0 1 0 12.8L17 17a7 7 0 0 0 0-10z" />
  </Svg>
)
export const MuteIcon = () => (
  <Svg>
    <path d="M3 9v6h4l5 4V5L7 9zM15 9.4 16.4 8l2.1 2.1L20.6 8 22 9.4 19.9 11.5 22 13.6 20.6 15l-2.1-2.1L16.4 15 15 13.6l2.1-2.1z" />
  </Svg>
)
export const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="m12 3 2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z" />
  </svg>
)
export const SunIcon = () => (
  <Svg>
    <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zM16.3 17.7l1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z" />
  </Svg>
)
export const MoonIcon = () => (
  <Svg>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Svg>
)
export const GearIcon = () => (
  <Svg>
    <path d="M10.5 2h3l.5 2.6 1.9.8 2.2-1.5 2.1 2.1-1.5 2.2.8 1.9L22 10.5v3l-2.6.5-.8 1.9 1.5 2.2-2.1 2.1-2.2-1.5-1.9.8-.5 2.6h-3l-.5-2.6-1.9-.8-2.2 1.5-2.1-2.1 1.5-2.2-.8-1.9L2 13.5v-3l2.6-.5.8-1.9-1.5-2.2 2.1-2.1 2.2 1.5 1.9-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
  </Svg>
)
export const PlusIcon = () => (
  <Svg size={16}>
    <path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z" />
  </Svg>
)
