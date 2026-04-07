import { useState } from 'react'
import type { DetectedObject } from '@/lib/types'

interface BoundingBoxOverlayProps {
  objects: DetectedObject[]
  imageWidth: number
  imageHeight: number
}

const COLORS = [
  '#4a7c59', // sage
  '#c0562a', // rust
  '#4a5568', // slate
  '#7c6a4a', // warm brown
  '#4a5c7c', // blue slate
]

export function BoundingBoxOverlay({
  objects,
  imageWidth,
  imageHeight,
}: BoundingBoxOverlayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (!objects || objects.length === 0) return null

  return (
    <svg
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    >
      {objects.map((obj, idx) => {
        const color = COLORS[idx % COLORS.length]
        const { x, y, width, height } = obj.bbox
        const isHovered = hoveredId === obj.id

        // Pixel label pin at top-left of box
        const labelX = Math.min(x, imageWidth - 120)
        const labelY = Math.max(y - 28, 4)

        return (
          <g key={obj.id}>
            {/* Box */}
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill={`${color}22`}
              stroke={color}
              strokeWidth={isHovered ? 2.5 : 1.5}
              rx={4}
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onMouseEnter={() => setHoveredId(obj.id)}
              onMouseLeave={() => setHoveredId(null)}
            />

            {/* Index pin */}
            <circle cx={x + 12} cy={y + 12} r={10} fill={color} />
            <text
              x={x + 12}
              y={y + 12}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={10}
              fontWeight="600"
            >
              {idx + 1}
            </text>

            {/* Label tooltip on hover */}
            {isHovered && (
              <g>
                <rect
                  x={labelX}
                  y={labelY}
                  width={Math.min(obj.label.length * 7 + 20, 160)}
                  height={24}
                  rx={4}
                  fill={color}
                />
                <text
                  x={labelX + 8}
                  y={labelY + 12}
                  fill="white"
                  fontSize={11}
                  fontWeight="500"
                  dominantBaseline="central"
                >
                  {obj.label} ({Math.round(obj.confidence * 100)}%)
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
