/**
 * Vectr's own icons (issue #28).
 *
 * Drawn here as plain geometry on a 16px grid: a pointer arrow, a rectangle, an
 * ellipse, an eye, a padlock, and disclosure carets. They are original to Vectr and
 * deliberately not Adobe's artwork, glyphs, or trade dress — the familiarity the UI
 * direction asks for comes from placement, terminology, and behavior, never from
 * copied assets.
 */

import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 14, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconSelect(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.2 1.6 L3.2 13.2 L6.3 10.2 L8.5 14.6 L10.4 13.7 L8.2 9.3 L12.6 9.3 Z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconRect(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.6" y="3.6" width="10.8" height="8.8" rx="0.8" />
    </Icon>
  )
}

export function IconEllipse(props: IconProps) {
  return (
    <Icon {...props}>
      <ellipse cx="8" cy="8" rx="5.4" ry="4.4" />
    </Icon>
  )
}

export function IconEye(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.4 8 C3.4 4.6 12.6 4.6 14.6 8 C12.6 11.4 3.4 11.4 1.4 8 Z" />
      <circle cx="8" cy="8" r="1.8" />
    </Icon>
  )
}

export function IconEyeOff(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M1.4 8 C3.4 4.6 12.6 4.6 14.6 8 C13.6 9.7 11.9 10.9 9.9 11.3" />
      <path d="M3.4 13 L12.6 3.4" />
    </Icon>
  )
}

export function IconLock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.6" y="7" width="8.8" height="6.2" rx="1" />
      <path d="M5.8 7 V5.3 A2.2 2.2 0 0 1 10.2 5.3 V7" />
    </Icon>
  )
}

export function IconUnlock(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.6" y="7" width="8.8" height="6.2" rx="1" />
      <path d="M5.8 7 V5.3 A2.2 2.2 0 0 1 10.2 5.3" />
    </Icon>
  )
}

export function IconDisclosureClosed(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.4 4.8 L10.4 8 L6.4 11.2 Z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconDisclosureOpen(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.8 6.4 L8 10.4 L11.2 6.4 Z" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconChevron(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.4 6.4 L8 10 L11.6 6.4" />
    </Icon>
  )
}
