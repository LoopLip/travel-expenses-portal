import { useMediaQuery } from '@mui/material'

/** true, если пользователь просит уменьшить анимации (prefers-reduced-motion). */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}

/** Длительность анимации MUI: 0 при reduced-motion. */
export function useMotionTimeout(ms = 250): number {
  return useReducedMotion() ? 0 : ms
}
