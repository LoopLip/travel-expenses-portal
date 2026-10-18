import type { ReactElement } from 'react'
import { Fade } from '@mui/material'
import { useMotionTimeout } from '../lib/useMotion'

/** Строка таблицы/элемент списка, плавно появляющийся и исчезающий внутри TransitionGroup. */
export default function FadeRow({ children, ...transitionProps }: { children: ReactElement }) {
  const timeout = useMotionTimeout(300)
  return <Fade {...transitionProps} timeout={timeout}>{children}</Fade>
}
