import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Circle, Image as KonvaImage, Text, Group, Rect } from 'react-konva'
import type Konva from 'konva'
import type { Vector2d } from 'konva/lib/types'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { apiClient } from '@/api/client'
import { cn } from '@/lib/utils'

export interface FloorPlanPin {
  id: string
  itemId: string
  label: string
  x: number | null
  y: number | null
  color?: string
}

interface FloorPlanBoardProps {
  imageUrl?: string | null
  imageWidth?: number | null
  imageHeight?: number | null
  pins: FloorPlanPin[]
  selectedPinId?: string | null
  /** Pin currently in "move mode" — shown in amber and awaiting a canvas click */
  movingPinId?: string | null
  readOnly?: boolean
  className?: string
  onPinSelect?: (pinId: string, itemId: string) => void
  onCanvasClick?: (x: number, y: number) => void
}

function useImage(url: string | null | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    if (!url) {
      setImage(null)
      return () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
        }
      }
    }

    const loadImage = async () => {
      try {
        const src = url.startsWith('/api')
          ? await apiClient.get(url, { responseType: 'blob' }).then((response) => {
              objectUrl = URL.createObjectURL(response.data)
              return objectUrl
            })
          : url

        const img = new window.Image()
        img.src = src
        img.onload = () => {
          if (!cancelled) {
            setImage(img)
          }
        }
        img.onerror = () => {
          if (!cancelled) {
            setImage(null)
          }
        }
      } catch {
        if (!cancelled) {
          setImage(null)
        }
      }
    }

    void loadImage()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [url])

  return image
}

export function FloorPlanBoard({
  imageUrl,
  imageWidth,
  imageHeight,
  pins,
  selectedPinId,
  movingPinId,
  readOnly = false,
  className,
  onPinSelect,
  onCanvasClick,
}: FloorPlanBoardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [boardWidth, setBoardWidth] = useState(720)
  const [viewportHeight, setViewportHeight] = useState(540)
  const [stageScale, setStageScale] = useState(1)
  const [stagePosition, setStagePosition] = useState<Vector2d>({ x: 0, y: 0 })
  const pinchStateRef = useRef<{ distance: number; center: Vector2d } | null>(null)
  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null)
  const image = useImage(imageUrl)

  useEffect(() => {
    const node = wrapperRef.current
    if (!node) {
      return
    }

    const updateSize = () => {
      setBoardWidth(Math.max(node.clientWidth, 280))
      const nextViewportHeight = Math.round(
        Math.min(window.innerHeight * 0.65, window.innerWidth < 640 ? 420 : 520)
      )
      setViewportHeight(Math.max(nextViewportHeight, 220))
    }
    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    window.addEventListener('resize', updateSize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const aspectRatio = useMemo(() => {
    if (imageWidth && imageHeight && imageWidth > 0 && imageHeight > 0) {
      return imageWidth / imageHeight
    }
    if (image && image.naturalWidth > 0 && image.naturalHeight > 0) {
      return image.naturalWidth / image.naturalHeight
    }
    return 4 / 3
  }, [image, imageHeight, imageWidth])

  const viewportWidth = boardWidth
  const contentWidth = imageWidth && imageWidth > 0
    ? imageWidth
    : image && image.naturalWidth > 0
      ? image.naturalWidth
      : boardWidth
  const contentHeight = imageHeight && imageHeight > 0
    ? imageHeight
    : image && image.naturalHeight > 0
      ? image.naturalHeight
      : Math.max(240, Math.round(boardWidth / aspectRatio))
  const stageHeight = viewportHeight
  const baseScale = Math.min(viewportWidth / contentWidth, stageHeight / contentHeight, 1)
  const effectiveScale = baseScale * stageScale

  const clampPosition = (position: Vector2d, scale: number): Vector2d => {
    const scaledWidth = contentWidth * scale
    const scaledHeight = contentHeight * scale
    const minX = scaledWidth <= viewportWidth ? (viewportWidth - scaledWidth) / 2 : viewportWidth - scaledWidth
    const maxX = scaledWidth <= viewportWidth ? minX : 0
    const minY = scaledHeight <= stageHeight ? (stageHeight - scaledHeight) / 2 : stageHeight - scaledHeight
    const maxY = scaledHeight <= stageHeight ? minY : 0
    return {
      x: Math.min(maxX, Math.max(position.x, minX)),
      y: Math.min(maxY, Math.max(position.y, minY)),
    }
  }

  const resetView = (nextScale = 1) => {
    setStageScale(nextScale)
    setStagePosition(clampPosition({ x: 0, y: 0 }, baseScale * nextScale))
  }

  useEffect(() => {
    setStagePosition((current) => clampPosition(current, effectiveScale))
  }, [effectiveScale, stageHeight, viewportWidth])

  const zoomAtPoint = (nextScale: number, point: Vector2d) => {
    const stage = stageRef.current
    if (!stage) {
      return
    }

    const clampedScale = Math.min(Math.max(nextScale, 1), 4)
    const mousePointTo = {
      x: (point.x - stagePosition.x) / effectiveScale,
      y: (point.y - stagePosition.y) / effectiveScale,
    }
    const nextEffectiveScale = baseScale * clampedScale

    const nextPosition = clampPosition(
      {
        x: point.x - mousePointTo.x * nextEffectiveScale,
        y: point.y - mousePointTo.y * nextEffectiveScale,
      },
      nextEffectiveScale
    )

    setStageScale(clampedScale)
    setStagePosition(nextPosition)
  }

  const toBoardCoordinates = (pointer: Vector2d) => ({
    x: Math.min(Math.max((pointer.x - stagePosition.x) / effectiveScale / contentWidth, 0), 1),
    y: Math.min(Math.max((pointer.y - stagePosition.y) / effectiveScale / contentHeight, 0), 1),
  })

  const handleCanvasClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!onCanvasClick) return

    const target = e.target
    const targetName = target.name()
    // Allow canvas clicks when in move-mode even if clicking on a non-image element
    const isBackground = target === target.getStage() || targetName === 'floor-image'
    if (!isBackground && !movingPinId) return

    const pos = stageRef.current?.getPointerPosition()
    if (!pos) return

    const normalized = toBoardCoordinates(pos)
    onCanvasClick(normalized.x, normalized.y)
  }

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()

    const stage = stageRef.current
    if (!stage) {
      return
    }

    const pointer = stage.getPointerPosition()
    if (!pointer) {
      return
    }

    const scaleBy = 1.08
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const nextScale = direction > 0 ? stageScale * scaleBy : stageScale / scaleBy
    zoomAtPoint(nextScale, pointer)
  }

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const touchEvent = e.evt
    if (touchEvent.touches.length !== 2) {
      pinchStateRef.current = null
      return
    }

    touchEvent.preventDefault()

    const stage = stageRef.current
    const containerRect = stage?.container().getBoundingClientRect()
    if (!stage || !containerRect) {
      return
    }

    const [touchA, touchB] = [touchEvent.touches[0], touchEvent.touches[1]]
    const center = {
      x: (touchA.clientX + touchB.clientX) / 2 - containerRect.left,
      y: (touchA.clientY + touchB.clientY) / 2 - containerRect.top,
    }
    const distance = Math.hypot(
      touchB.clientX - touchA.clientX,
      touchB.clientY - touchA.clientY
    )

    const previous = pinchStateRef.current
    if (!previous) {
      pinchStateRef.current = { distance, center }
      return
    }

    const scaleFactor = distance / previous.distance
    const nextScale = stageScale * scaleFactor
    zoomAtPoint(nextScale, center)
    const nextEffectiveScale = baseScale * Math.min(Math.max(nextScale, 1), 4)

    const deltaCenter = {
      x: center.x - previous.center.x,
      y: center.y - previous.center.y,
    }
    setStagePosition((current) => clampPosition({
      x: current.x + deltaCenter.x,
      y: current.y + deltaCenter.y,
    }, nextEffectiveScale))

    pinchStateRef.current = { distance, center }
  }

  const handleTouchEnd = () => {
    pinchStateRef.current = null
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => zoomAtPoint(stageScale / 1.2, { x: viewportWidth / 2, y: stageHeight / 2 })}>
          <ZoomOut className="w-4 h-4" />
          Zoom Out
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => zoomAtPoint(stageScale * 1.2, { x: viewportWidth / 2, y: stageHeight / 2 })}>
          <ZoomIn className="w-4 h-4" />
          Zoom In
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={resetView}>
          <Maximize2 className="w-4 h-4" />
          Fit
        </Button>
      </div>

      <div
        ref={wrapperRef}
        className="w-full overflow-hidden rounded-2xl border border-kraft-200 bg-kraft-100 shadow-sm"
        style={{ height: `${stageHeight}px` }}
      >
        <Stage
          ref={stageRef}
          width={viewportWidth}
          height={stageHeight}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="touch-none"
        >
          <Layer>
            <Rect width={viewportWidth} height={stageHeight} fill="#f3eadb" listening={false} />
            <Group x={stagePosition.x} y={stagePosition.y} scaleX={effectiveScale} scaleY={effectiveScale}>
              {image ? (
                <KonvaImage
                  image={image}
                  width={contentWidth}
                  height={contentHeight}
                  name="floor-image"
                />
              ) : null}

              {(() => {
                const visiblePins = pins.filter((pin) => pin.x !== null && pin.y !== null)
                // Render hovered pin last so it sits on top
                const sorted = hoveredPinId
                  ? [...visiblePins.filter((p) => p.id !== hoveredPinId),
                     ...visiblePins.filter((p) => p.id === hoveredPinId)]
                  : visiblePins

                return sorted.map((pin) => {
                  const x = (pin.x ?? 0) * contentWidth
                  const y = (pin.y ?? 0) * contentHeight
                  const isSelected = pin.id === selectedPinId
                  const isMoving  = pin.id === movingPinId
                  const isHovered = pin.id === hoveredPinId

                  const fillColor = isMoving ? '#d97706' : (pin.color ?? '#4a7c59')
                  const radius = isMoving ? 13 : (isSelected || isHovered) ? 12 : 9
                  const labelText = isMoving ? `Moving: ${pin.label}` : pin.label
                  const fontSize = 11
                  const labelPad = 4
                  // Estimate label rect width: ~6.5px per char + horizontal padding
                  const labelW = Math.max(labelText.length * 6.5 + labelPad * 2, 32)
                  const labelH = fontSize + labelPad * 2
                  const labelX = 14
                  const labelY = -(labelH / 2)
                  // Default: 10% white; hover/selected: solid white
                  const bgOpacity = isHovered || isSelected ? 1 : 0.1

                  return (
                    <Group
                      key={pin.id}
                      x={x}
                      y={y}
                      onMouseEnter={() => setHoveredPinId(pin.id)}
                      onMouseLeave={() => setHoveredPinId(null)}
                      onClick={(e) => {
                        e.cancelBubble = true
                        onPinSelect?.(pin.id, pin.itemId)
                      }}
                      onTap={(e) => {
                        e.cancelBubble = true
                        onPinSelect?.(pin.id, pin.itemId)
                      }}
                    >
                      <Circle
                        radius={radius}
                        fill={fillColor}
                        stroke={isMoving ? '#fff' : (isSelected || isHovered) ? '#f7f2e8' : '#fff'}
                        strokeWidth={isMoving ? 3 : (isSelected || isHovered) ? 3 : 2}
                        shadowColor="rgba(0,0,0,0.35)"
                        shadowBlur={isMoving ? 10 : isHovered ? 14 : 6}
                        shadowOffsetY={isHovered ? 3 : 2}
                        scaleX={isHovered ? 1.18 : 1}
                        scaleY={isHovered ? 1.18 : 1}
                        name="pin-circle"
                      />
                      {/* Label background */}
                      <Rect
                        x={labelX}
                        y={labelY}
                        width={labelW}
                        height={labelH}
                        fill="white"
                        opacity={bgOpacity}
                        cornerRadius={3}
                        listening={false}
                      />
                      <Text
                        x={labelX}
                        y={labelY}
                        width={labelW}
                        height={labelH}
                        text={labelText}
                        fontSize={fontSize}
                        padding={labelPad}
                        fill={isMoving ? '#92400e' : (isHovered || isSelected) ? '#1a0f07' : '#2d241b'}
                        fontStyle={isHovered || isSelected ? 'bold' : 'normal'}
                        listening={false}
                        align="left"
                        verticalAlign="middle"
                      />
                    </Group>
                  )
                })
              })()}
            </Group>
          </Layer>
        </Stage>
      </div>

      <p className="text-xs text-kraft-400 text-center">
        {readOnly
          ? 'Tap a pin to inspect it.'
          : movingPinId
          ? 'Tap anywhere on the floor plan to move the pin there. Tap the same pin to cancel.'
          : 'Pinch to zoom · tap a pin to select and move it · tap the map to place a new pin.'}
      </p>
    </div>
  )
}
