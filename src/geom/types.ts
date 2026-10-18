/**
 * Colour primitives shared by the geometry and document layers (Phase 3.1).
 *
 * They live at L0 so the document can name an ink and the colour conversion can read it without
 * the lower layer depending on the higher one.
 */

/** A CMYK ink definition; the RGB used for display is derived from it. */
export type Cmyk = { c: number; m: number; y: number; k: number }
