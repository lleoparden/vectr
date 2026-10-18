/**
 * Shell geometry tokens (issue #28).
 *
 * Colors, type, and radii live in `src/styles.css` as Tailwind v4 `@theme`
 * variables, because those are styling concerns. The numbers here are layout
 * geometry that the TypeScript side needs as values rather than classes: the dock
 * width, row metrics, and the zoom steps shared by the menus, the shortcuts, and
 * the canvas. Keeping them in one place is what stops three components from
 * disagreeing about how wide a panel is.
 */

/** Width of the right panel dock. Illustrator ships docked panels too. */
export const DOCK_WIDTH = 268

/** Width of the left tool palette column. */
export const PALETTE_WIDTH = 40

/** Height of a Layers panel row, and its indent step per nesting level. */
export const LAYER_ROW_HEIGHT = 22
export const LAYER_INDENT = 12

/** Size of the tool palette buttons and the panel row toggle buttons. */
export const TOOL_BUTTON_SIZE = 28
export const ROW_TOGGLE_SIZE = 18

/** The zoom steps the View menu and Ctrl+= / Ctrl+- walk through. */
export { ZOOM_STEPS, ZOOM_MIN, ZOOM_MAX, FIT_PADDING } from '../../geom/viewport.ts'

/** Interactive zoom bounds, shared with the wheel handler. */

/** Margin left around the artboard when fitting it in the window. */

/** Document-window chrome heights, so the canvas can fill what is left. */
export const MENU_BAR_HEIGHT = 26
export const STATUS_BAR_HEIGHT = 22
/** The tool options bar under the menu bar, Illustrator's Control panel. */
export const TOOL_OPTIONS_HEIGHT = 30
