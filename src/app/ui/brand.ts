/**
 * The brand palette, as values (issue: rose palette).
 *
 * DOM chrome uses the Tailwind tokens in «src/styles.css». Canvas overlays cannot read CSS variables, so the
 * six roles also exist here as numbers for the few places that draw with Skia or a stroke style. The two must
 * change together; «tests/uiStandards.test.ts» checks that the site and the stylesheet agree with this file.
 */

export const BRAND = {
  /** Main background. */
  charcoal: '#1b1b1f',
  /** Panels and alternate sections. */
  charcoalRaised: '#242428',
  /** Brand: buttons, selection, fills. */
  roseVale: '#a94a4a',
  /** Links, small text, focus rings. */
  roseLight: '#e07c7b',
  /** Hover and pressed states. */
  roseDeep: '#8b3a3a',
  /** Text and the logo letter. */
  offWhite: '#f3eee8',
} as const
