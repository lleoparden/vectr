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

/** Direct Selection: the same arrow, unwelded — Illustrator's black/white arrow pair, drawn here. */
export function IconDirectSelect(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.2 1.6 L3.2 13.2 L6.3 10.2 L8.5 14.6 L10.4 13.7 L8.2 9.3 L12.6 9.3 Z" />
    </Icon>
  )
}

/** Lasso: a freehand loop with the tail a drag leaves behind. */
/** Artboard: a page with a folded corner, which is the sheet its artwork sits on. */
/** Hand: the palm, for the tool that moves the view under your cursor. */
export function IconZoom(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="4.4" />
      <path d="M11.2 11.2 14.6 14.6" />
      <path d="M6.2 8h3.6" />
      <path d="M8 6.2v3.6" />
    </Icon>
  )
}

export function IconHand(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.2 8V4.6a1 1 0 0 1 2 0V8" />
      <path d="M7.2 7.6V3.6a1 1 0 0 1 2 0v4" />
      <path d="M9.2 7.8V4.4a1 1 0 0 1 2 0v3.6" />
      <path d="M11.2 8.2V6a1 1 0 0 1 2 0v4.2c0 2.2-1.6 4-3.9 4-1.7 0-2.7-.7-3.6-1.9L3.9 9.9c-.5-.8.6-1.8 1.3-1.1l.9 1" />
    </Icon>
  )
}

export function IconArtboard(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 2.5h7.5l3.5 3.5v7.5h-11z" />
      <path d="M10 2.5V6h3.5" />
    </Icon>
  )
}

export function IconLasso(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.4 3.1a4.6 3.6 0 1 0 2.2 6.9c1.1.5 2.2.4 3-0.3" />
      <path d="M9.6 9.7c0.6 1.4 0.2 2.6-0.9 3.4" />
      <circle cx="7.4" cy="6.7" r="0.5" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function IconPen(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 13 L5.2 12.2 L12.4 5 L11 3.6 L3.8 10.8 Z" />
      <path d="M10.2 4.8 L11.8 6.4" />
      <circle cx="7" cy="9" r="0.5" fill="currentColor" stroke="none" />
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

/** Raster placement: an original framed landscape icon, not an Adobe asset. */
export function IconImage(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.3" y="3" width="11.4" height="10" rx="1.1" />
      <circle cx="5.4" cy="6.2" r="1" />
      <path d="M3.5 11 L7 7.7 L9.1 9.6 L10.6 8.1 L12.5 11" />
    </Icon>
  )
}

/** Type tool: a serif-free capital T on the 16px grid. */
export function IconType(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.6}>
      <path d="M3 4.2 H13" />
      <path d="M8 4.2 V12.4" />
    </Icon>
  )
}

/** Rounded rectangle tool: the rectangle with generous corners (owner request, PATH-01). */
export function IconRoundedRect(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.6" y="3.6" width="10.8" height="8.8" rx="3.4" />
    </Icon>
  )
}

/** Polygon tool: a hexagon, which is the six sides the tool starts with. */
export function IconPolygon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2.2 L13.2 5.2 V10.8 L8 13.8 L2.8 10.8 V5.2 Z" />
    </Icon>
  )
}

/** Star tool: a five-pointed star, the star the tool starts with. */
export function IconStar(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 2.2 L9.7 6.1 L13.9 6.5 L10.7 9.2 L11.7 13.3 L8 11.1 L4.3 13.3 L5.3 9.2 L2.1 6.5 L6.3 6.1 Z" />
    </Icon>
  )
}

/** Line Segment tool: the diagonal Illustrator's tool draws first. */
export function IconLine(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.6}>
      <path d="M3 13 L13 3" />
    </Icon>
  )
}

/** Arc tool: a quarter arc, the default 0°–90° sweep. */
export function IconArc(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.6}>
      <path d="M13 12.5 A9 9 0 0 1 3.5 3" />
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

/** Panel flyout: the three-line control Illustrator puts at a panel's top right. */
export function IconFlyout(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.6}>
      <path d="M2.5 4 H13.5" />
      <path d="M2.5 8 H13.5" />
      <path d="M2.5 12 H13.5" />
    </Icon>
  )
}

/** New Layer: a layer with a plus, the control Illustrator puts at the panel's foot. */
export function IconNewLayer(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.5}>
      <path d="M2.5 3.5 H9.5 V12.5 H2.5 Z" />
      <path d="M12 6.5 V12.5" />
      <path d="M9 9.5 H15" />
    </Icon>
  )
}

/** Duplicate: two offset copies, which is what the action makes. */
export function IconDuplicate(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.5}>
      <path d="M5.5 2.5 H13.5 V10.5" />
      <path d="M2.5 5.5 H10.5 V13.5 H2.5 Z" />
    </Icon>
  )
}

/** Delete Selection: the trash can Illustrator uses. */
export function IconDelete(props: IconProps) {
  return (
    <Icon {...props} strokeWidth={1.5}>
      <path d="M3.5 5 H12.5" />
      <path d="M6.5 5 V3.5 H9.5 V5" />
      <path d="M4.5 5 L5.2 13 H10.8 L11.5 5" />
    </Icon>
  )
}
