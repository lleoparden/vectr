/**
 * Missing-font detection (Phase 6.8).
 *
 * Vectr ships one face (Inter), so any other family in a document is missing until substituted. Detection
 * is pure: the caller supplies the available families, and the same list drives the renderer's own
 * substitution reporting, the Resolve Missing Fonts dialog, and the substitution command.
 */

import { isText, type Document, type LayerNode, type TextNode } from './types.ts'

export function availableFamilies(): string[] {
  return ['Inter']
}

function walk(node: LayerNode, visit: (node: LayerNode) => void): void {
  visit(node)
  if (node.type === 'group') for (const child of node.children) walk(child, visit)
}

/** Families referenced by text objects that are not in the available list, case-insensitively. */
export function missingFontFamilies(document: Document, available: string[] = availableFamilies()): string[] {
  const known = new Set(available.map((family) => family.toLowerCase()))
  const missing = new Map<string, string>()
  walk(document.root, (node) => {
    if (!isText(node)) return
    const key = node.fontFamily.toLowerCase()
    if (!known.has(key) && !missing.has(key)) missing.set(key, node.fontFamily)
  })
  return [...missing.values()].sort((left, right) => left.localeCompare(right))
}

/** Text objects whose family is missing, in paint order. */
export function textNodesWithMissingFonts(
  document: Document,
  available: string[] = availableFamilies(),
): TextNode[] {
  const known = new Set(available.map((family) => family.toLowerCase()))
  const nodes: TextNode[] = []
  walk(document.root, (node) => {
    if (isText(node) && !known.has(node.fontFamily.toLowerCase())) nodes.push(node)
  })
  return nodes
}
