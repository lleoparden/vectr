/**
 * The command registry (Phase 3.4).
 *
 * One table for what a command is: its id, the label the interface prints, and the chord that runs
 * it. The menus, the palette tooltips, the shortcut map, and the action hub all read from here, so a
 * command cannot have three names or two chords. The *implementation* stays in `runEditorAction`;
 * this module is data only, which is why it can sit at the engine layer without importing React.
 *
 * Menu *placement* - which menu, which order, which separators - still lives in `menuModel.ts`, and a
 * test asserts every command appears there exactly once with the label from this table.
 */

export type KeyChord = {
  /** Lower-case `KeyboardEvent.key`, with two accepted spellings: `delete`/`backspace`. */
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

export type ShortcutSpec = {
  id: EditorActionId
  chord: KeyChord
  /** True when this is Illustrator's own default for the command. */
  illustratorDefault: boolean
  /** Why a divergence exists; required when `illustratorDefault` is false. */
  note?: string
}

export const ACTION_IDS = [
  'tool.select',
  'tool.directSelect',
  'tool.lasso',
  'tool.pen',
  'tool.shapeBuilder',
  'tool.livePaint',
  'tool.rect',
  'tool.roundedRect',
  'tool.ellipse',
  'tool.line',
  'tool.polygon',
  'tool.star',
  'tool.arc',
  'tool.hand',
  'tool.text',
  'tool.zoom',
  'path.addAnchor',
  'path.deleteAnchor',
  'path.convertSmooth',
  'path.convertCorner',
  'path.join',
  'path.average',
  'path.unite',
  'path.intersect',
  'path.subtract',
  'path.exclude',
  'path.divide',
  'path.simplify',
  'path.offsetPath',
  'path.profileUniform',
  'path.profileTaperStart',
  'path.profileTaperEnd',
  'path.profileBulge',
  'path.outlineStroke',
  'object.compoundMake',
  'object.compoundRelease',
  'file.place',
  'file.placeLinked',
  'file.new',
  'file.open',
  'file.save',
  'file.saveAs',
  'file.recover',
  'type.sizeUp',
  'type.sizeDown',
  'type.alignLeft',
  'type.alignCenter',
  'type.alignRight',
  'edit.undo',
  'edit.redo',
  'edit.clear',
  'edit.preferences',
  'select.all',
  'select.deselect',
  'object.hideSelection',
  'object.showAll',
  'object.lockSelection',
  'object.unlockAll',
  'object.group',
  'object.ungroup',
  'object.arrangeFront',
  'object.arrangeForward',
  'object.arrangeBackward',
  'object.arrangeBack',
  'object.duplicate',
  'object.makeClip',
  'object.releaseClip',
  'object.isolate',
  'object.exitIsolation',
  'object.alignLeft',
  'object.alignCenterH',
  'object.alignRight',
  'object.alignTop',
  'object.alignCenterV',
  'object.alignBottom',
  'object.distributeH',
  'object.distributeV',
  'edit.cut',
  'edit.copy',
  'edit.paste',

  'layer.new',
  'artboard.new',
  'artboard.delete',
  'view.zoomIn',
  'view.zoomOut',
  'view.fitArtboard',
  'view.actualSize',
  'view.rulers',
  'view.grid',
  'view.guides',
  'view.clearGuides',
  'view.smartGuides',
  'window.togglePanel.layers',
  'window.togglePanel.properties',
  'window.togglePanel.align',
  'window.togglePanel.transform',
  'window.togglePanel.pathfinder',
  'window.togglePanel.appearance',
  'window.togglePanel.color',
  'help.about',
] as const

export type EditorActionId = (typeof ACTION_IDS)[number]

export const ACTION_LABELS: Record<EditorActionId, string> = {
  'tool.select': 'Selection Tool',
  'tool.directSelect': 'Direct Selection Tool',
  'tool.lasso': 'Lasso Tool',
  'tool.pen': 'Pen Tool',
  'tool.shapeBuilder': 'Shape Builder Tool',
  'tool.livePaint': 'Live Paint Bucket',
  'tool.rect': 'Rectangle Tool',
  'tool.roundedRect': 'Rounded Rectangle Tool',
  'tool.ellipse': 'Ellipse Tool',
  'tool.line': 'Line Segment Tool',
  'tool.polygon': 'Polygon Tool',
  'tool.star': 'Star Tool',
  'tool.arc': 'Arc Tool',
  'tool.hand': 'Hand Tool',
  'tool.text': 'Type Tool',
  'tool.zoom': 'Zoom Tool',
  'path.addAnchor': 'Add Anchor Point',
  'path.deleteAnchor': 'Delete Anchor Point',
  'path.convertSmooth': 'Convert to Smooth',
  'path.convertCorner': 'Convert to Corner',
  'path.join': 'Join Paths',
  'path.average': 'Average',
  'path.unite': 'Unite',
  'path.intersect': 'Intersect',
  'path.subtract': 'Subtract',
  'path.exclude': 'Exclude',
  'path.divide': 'Divide',
  'path.simplify': 'Simplify',
  'path.offsetPath': 'Offset Path',
  'path.profileUniform': 'Uniform Width',
  'path.profileTaperStart': 'Taper Start',
  'path.profileTaperEnd': 'Taper End',
  'path.profileBulge': 'Bulge',
  'path.outlineStroke': 'Outline Stroke',
  'object.compoundMake': 'Make Compound Path',
  'object.compoundRelease': 'Release Compound Path',
  'file.place': 'Place…',
  'file.placeLinked': 'Place Linked…',
  'file.new': 'New',
  'file.open': 'Open…',
  'file.save': 'Save',
  'file.saveAs': 'Save As…',
  'file.recover': 'Recover Unsaved Work',
  'type.sizeUp': 'Increase Size',
  'type.sizeDown': 'Decrease Size',
  'type.alignLeft': 'Horizontal Align Left',
  'type.alignCenter': 'Horizontal Align Center',
  'type.alignRight': 'Horizontal Align Right',
  'edit.undo': 'Undo',
  'edit.redo': 'Redo',
  'edit.clear': 'Clear',
  'edit.preferences': 'Preferences…',
  'select.all': 'All',
  'select.deselect': 'Deselect',
  'object.hideSelection': 'Hide Selection',
  'object.showAll': 'Show All',
  'object.lockSelection': 'Lock Selection',
  'object.unlockAll': 'Unlock All',
  'object.group': 'Group',
  'object.ungroup': 'Ungroup',
  'object.arrangeFront': 'Bring to Front',
  'object.arrangeForward': 'Bring Forward',
  'object.arrangeBackward': 'Send Backward',
  'object.arrangeBack': 'Send to Back',
  'object.duplicate': 'Duplicate',
  'object.makeClip': 'Make Clipping Mask',
  'object.releaseClip': 'Release Clipping Mask',
  'object.isolate': 'Isolate Selection',
  'object.exitIsolation': 'Exit Isolation Mode',
  'object.alignLeft': 'Horizontal Align Left',
  'object.alignCenterH': 'Horizontal Align Center',
  'object.alignRight': 'Horizontal Align Right',
  'object.alignTop': 'Vertical Align Top',
  'object.alignCenterV': 'Vertical Align Center',
  'object.alignBottom': 'Vertical Align Bottom',
  'object.distributeH': 'Distribute Horizontal Centers',
  'object.distributeV': 'Distribute Vertical Centers',
  'edit.cut': 'Cut',
  'edit.copy': 'Copy',
  'edit.paste': 'Paste',
  'layer.new': 'New Layer',
  'artboard.new': 'New Artboard',
  'artboard.delete': 'Delete Artboard',
  'view.zoomIn': 'Zoom In',
  'view.zoomOut': 'Zoom Out',
  'view.fitArtboard': 'Fit Artboard in Window',
  'view.actualSize': 'Actual Size',
  'view.rulers': 'Rulers',
  'view.grid': 'Grid',
  'view.guides': 'Guides',
  'view.clearGuides': 'Clear Guides',
  'view.smartGuides': 'Smart Guides',
  'window.togglePanel.layers': 'Layers',
  'window.togglePanel.properties': 'Properties',
  'window.togglePanel.align': 'Align',
  'window.togglePanel.transform': 'Transform',
  'window.togglePanel.pathfinder': 'Pathfinder',
  'window.togglePanel.appearance': 'Appearance',
  'window.togglePanel.color': 'Color',
  'help.about': 'About Vectr',
}

export const SHORTCUTS: readonly ShortcutSpec[] = [
  // Tools (Illustrator: V = Selection, A = Direct Selection, Q = Lasso, M = Rectangle, L = Ellipse,
  // T = Type).
  { id: 'tool.select', chord: { key: 'v' }, illustratorDefault: true },
  { id: 'tool.directSelect', chord: { key: 'a' }, illustratorDefault: true },
  { id: 'tool.lasso', chord: { key: 'q' }, illustratorDefault: true },
  { id: 'tool.pen', chord: { key: 'p' }, illustratorDefault: true },
  { id: 'tool.shapeBuilder', chord: { key: 'm', shift: true }, illustratorDefault: true },
  { id: 'tool.livePaint', chord: { key: 'k' }, illustratorDefault: true },
  { id: 'path.join', chord: { key: 'j', ctrl: true }, illustratorDefault: true },
  { id: 'object.compoundMake', chord: { key: '8', ctrl: true }, illustratorDefault: true },
  { id: 'object.compoundRelease', chord: { key: '8', ctrl: true, alt: true }, illustratorDefault: true },
  { id: 'tool.rect', chord: { key: 'm' }, illustratorDefault: true },
  { id: 'tool.roundedRect', chord: { key: 'j' }, illustratorDefault: false, note: 'Illustrator has no key for the rounded rectangle tool, which Vectr does' },
  { id: 'tool.ellipse', chord: { key: 'l' }, illustratorDefault: true },
  // Illustrator's Line Segment tool. Polygon, Star, and Arc have no Illustrator defaults, so
  // Vectr deliberately does not invent keys that would collide with a real Illustrator habit.
  { id: 'tool.line', chord: { key: '\\' }, illustratorDefault: true },
  { id: 'tool.text', chord: { key: 't' }, illustratorDefault: true },
  // H is Illustrator's own chord for the Hand tool; Space reaches it temporarily.
  { id: 'tool.hand', chord: { key: 'h' }, illustratorDefault: true },
  // Z is Illustrator's own chord for the Zoom tool.
  { id: 'tool.zoom', chord: { key: 'z' }, illustratorDefault: true },

  // File (Illustrator's document chords, then Place).
  { id: 'file.new', chord: { key: 'n', ctrl: true }, illustratorDefault: true },
  { id: 'file.open', chord: { key: 'o', ctrl: true }, illustratorDefault: true },
  { id: 'file.save', chord: { key: 's', ctrl: true }, illustratorDefault: true },
  { id: 'file.saveAs', chord: { key: 's', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'file.place', chord: { key: 'p', ctrl: true, shift: true }, illustratorDefault: true },

  // Type (Illustrator's size and alignment chords).
  { id: 'type.sizeUp', chord: { key: '>', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.sizeDown', chord: { key: '<', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.alignLeft', chord: { key: 'l', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.alignCenter', chord: { key: 'c', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'type.alignRight', chord: { key: 'r', ctrl: true, shift: true }, illustratorDefault: true },

  // Edit.
  // Edit (Illustrator's Preferences chord on Windows is Ctrl+K).
  { id: 'edit.preferences', chord: { key: 'k', ctrl: true }, illustratorDefault: true },
  { id: 'edit.undo', chord: { key: 'z', ctrl: true }, illustratorDefault: true },
  { id: 'edit.redo', chord: { key: 'z', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'edit.cut', chord: { key: 'x', ctrl: true }, illustratorDefault: true },
  { id: 'edit.copy', chord: { key: 'c', ctrl: true }, illustratorDefault: true },
  { id: 'edit.paste', chord: { key: 'v', ctrl: true }, illustratorDefault: true },
  { id: 'edit.clear', chord: { key: 'delete' }, illustratorDefault: true },
  { id: 'edit.clear', chord: { key: 'backspace' }, illustratorDefault: false, note: 'Extra binding for keyboards without a Delete key.' },

  // Select.
  { id: 'select.all', chord: { key: 'a', ctrl: true }, illustratorDefault: true },
  { id: 'select.deselect', chord: { key: 'a', ctrl: true, shift: true }, illustratorDefault: true },

  // Object.
  { id: 'object.group', chord: { key: 'g', ctrl: true }, illustratorDefault: true },
  { id: 'object.ungroup', chord: { key: 'g', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'object.arrangeFront', chord: { key: ']', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'object.arrangeForward', chord: { key: ']', ctrl: true }, illustratorDefault: true },
  { id: 'object.arrangeBackward', chord: { key: '[', ctrl: true }, illustratorDefault: true },
  { id: 'object.arrangeBack', chord: { key: '[', ctrl: true, shift: true }, illustratorDefault: true },
  { id: 'object.hideSelection', chord: { key: '3', ctrl: true }, illustratorDefault: true },
  { id: 'object.showAll', chord: { key: '3', ctrl: true, alt: true }, illustratorDefault: true },
  { id: 'object.lockSelection', chord: { key: '2', ctrl: true }, illustratorDefault: true },
  { id: 'object.unlockAll', chord: { key: '2', ctrl: true, alt: true }, illustratorDefault: true },

  // View.
  { id: 'view.zoomIn', chord: { key: '=', ctrl: true }, illustratorDefault: true },
  { id: 'view.zoomIn', chord: { key: '+', ctrl: true }, illustratorDefault: true },
  { id: 'view.zoomOut', chord: { key: '-', ctrl: true }, illustratorDefault: true },
  { id: 'view.fitArtboard', chord: { key: '0', ctrl: true }, illustratorDefault: true },
  { id: 'view.actualSize', chord: { key: '1', ctrl: true }, illustratorDefault: true },
  { id: 'view.smartGuides', chord: { key: 'u', ctrl: true }, illustratorDefault: true },
  // Illustrator's own view chords.
  { id: 'view.rulers', chord: { key: 'r', ctrl: true }, illustratorDefault: true },
  { id: 'view.grid', chord: { key: "'", ctrl: true }, illustratorDefault: true },
  { id: 'view.guides', chord: { key: ';', ctrl: true }, illustratorDefault: true },
  { id: 'view.clearGuides', chord: { key: ';', ctrl: true, alt: true }, illustratorDefault: true },

  // Window: Illustrator's panel shortcuts.
  { id: 'window.togglePanel.layers', chord: { key: 'f7' }, illustratorDefault: true },
  { id: 'window.togglePanel.color', chord: { key: 'f6' }, illustratorDefault: true },
  { id: 'window.togglePanel.appearance', chord: { key: 'f6', shift: true }, illustratorDefault: true },
]

export type CommandRecord = {
  id: EditorActionId
  label: string
  chord?: KeyChord
  illustratorDefault?: boolean
  note?: string
}

/** Every command, with the label and chord the interface must use. */
export const COMMANDS: readonly CommandRecord[] = ACTION_IDS.map((id) => {
  const shortcut = SHORTCUTS.find((spec) => spec.id === id)
  return {
    id,
    label: ACTION_LABELS[id],
    chord: shortcut?.chord,
    illustratorDefault: shortcut?.illustratorDefault,
    note: shortcut?.note,
  }
})

/** The label for a command; the only place the interface reads one. */
export function labelFor(id: EditorActionId): string {
  return ACTION_LABELS[id]
}

/** The chord that runs a command, or undefined when it has none. */
export function chordFor(id: EditorActionId): KeyChord | undefined {
  return SHORTCUTS.find((spec) => spec.id === id)?.chord
}
