import { onMount, onCleanup, createEffect } from 'solid-js'
import uPlot from 'uplot'

interface SparklineProps {
  data: number[]
  height?: number
  width?: number
  color?: string
  class?: string
}

export default function Sparkline(props: SparklineProps) {
  let container: HTMLDivElement | undefined
  let chart: uPlot | undefined

  const getColor = () => {
    const color = props.color || '#3b82f6'
    return color
  }

  const createChart = () => {
    if (!container || props.data.length === 0) return

    // Clean up existing chart
    if (chart) {
      chart.destroy()
      chart = undefined
    }

    const width = props.width || container.clientWidth || 120
    const height = props.height || 32

    // Generate x values (0 to n-1)
    const xData = props.data.map((_, i) => i)
    const yData = props.data

    const opts: uPlot.Options = {
      width,
      height,
      cursor: { show: false },
      select: { show: false },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: {
          auto: true,
          range: (u, min, max) => {
            const padding = (max - min) * 0.1 || 10
            return [Math.max(0, min - padding), max + padding]
          },
        },
      },
      axes: [{ show: false }, { show: false }],
      series: [
        {},
        {
          stroke: getColor(),
          width: 1.5,
          fill: `${getColor()}20`,
        },
      ],
    }

    chart = new uPlot(opts, [xData, yData], container)
  }

  onMount(() => {
    createChart()
  })

  createEffect(() => {
    // Re-create chart when data changes
    props.data
    createChart()
  })

  onCleanup(() => {
    if (chart) {
      chart.destroy()
    }
  })

  return <div ref={container} class={props.class || ''} />
}
