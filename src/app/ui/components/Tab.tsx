/**
 * The one panel tab (issue #133).
 *
 * A dock tab is a button with a selected state, an expanded state for its group, and a title that says what
 * clicking it will do - the same thing in every group, so it is one component.
 */

export type TabProps = {
  label: string
  selected: boolean
  expanded: boolean
  title: string
  onClick: () => void
}

export function Tab({ label, selected, expanded, title, onClick }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-expanded={expanded}
      title={title}
      onClick={onClick}
      data-ui-tab
      className={`flex-1 px-2 py-[5px] text-ui-xs ${
        selected
          ? 'bg-chrome text-ink shadow-[inset_0_2px_0_var(--color-accent)]'
          : 'text-ink-faint hover:bg-chrome-hover hover:text-ink-muted'
      }`}
    >
      {label}
    </button>
  )
}
