import { For } from 'solid-js'
import type { AnalyticsTimeRange } from '@observer/shared'

interface TimeRangeSelectorProps {
  selected: AnalyticsTimeRange
  onSelect: (range: AnalyticsTimeRange) => void
}

export default function TimeRangeSelector(props: TimeRangeSelectorProps) {
  const ranges: { value: AnalyticsTimeRange; label: string }[] = [
    { value: '1d', label: '1D' },
    { value: '1w', label: '1W' },
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
  ]

  return (
    <div class="flex items-center gap-2 flex-wrap">
      <For each={ranges}>
        {(range) => (
          <button
            onClick={() => props.onSelect(range.value)}
            class={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              props.selected === range.value
                ? 'border-[var(--text)] bg-[var(--text)] text-[var(--bg)] font-medium'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {range.label}
          </button>
        )}
      </For>
    </div>
  )
}
