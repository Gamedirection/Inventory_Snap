import { useEffect, useRef, useState, useCallback } from 'react'
import { Stage, Layer, Rect, Text, Image as KonvaImage, Group, Circle } from 'react-konva'
import type Konva from 'konva'
import { Square, MousePointer2, Trash2, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface MapRoom {
  id: string           // location_id
  label: string
  x: number            // normalized 0-1
  y: number
  width: number
  height: number
  item_count?: number
}

export interface VectorShape {
  id: string
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  label: string
  location_id?: string
}

interface FloorMapCanvasProps {
  imageUrl?: string | null
  shapes: VectorShape[]
  rooms?: MapRoom[]
  width?: number
  height?: number
  readOnly?: boolean
  selectedRoomId?: string | null
  onShapesChange?: (shapes: VectorShape[]) => void
  onRoomClick?: (locationId: string) => void
  className?: string
}

type Tool = 'select' | 'rect'

function useImage(url: string | null | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) { setImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    img.onload = () => setImage(img)
    img.onerror = () => setImage(null)
  }, [url])
  return image
}

export function FloorMapCanvas({
  imageUrl,
  shapes,
  rooms = [],
  width = 800,
  height = 600,
  readOnly = false,
  selectedRoomId,
  onShapesChange,
  onRoomClick,
  className,
}: FloorMapCanvasProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [drawing, setDrawing] = useState<Partial<VectorShape> | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const bgImage = useImage(imageUrl)

  const SCALE_X = width
  const SCALE_Y = height

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (readOnly || tool !== 'rect') return
    const pos = stageRef.current?.getPointerPosition()
    if (!pos) return
    setDrawing({
      id: `shape_${Date.now()}`,
      type: 'rect',
      x: pos.x / SCALE_X,
      y: pos.y / SCALE_Y,
      width: 0,
      height: 0,
      label: 'Room',
    })
    setSelectedId(null)
  }, [readOnly, tool, SCALE_X, SCALE_Y])

  const handleMouseMove = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!drawing || readOnly) return
    const pos = stageRef.current?.getPointerPosition()
    if (!pos) return
    setDrawing(prev => prev ? {
      ...prev,
      width: pos.x / SCALE_X - (prev.x ?? 0),
      height: pos.y / SCALE_Y - (prev.y ?? 0),
    } : null)
  }, [drawing, readOnly, SCALE_X, SCALE_Y])

  const handleMouseUp = useCallback(() => {
    if (!drawing || readOnly) return
    if (Math.abs((drawing.width ?? 0) * SCALE_X) > 20 && Math.abs((drawing.height ?? 0) * SCALE_Y) > 20) {
      const newShape: VectorShape = {
        id: drawing.id!,
        type: 'rect',
        x: Math.min(drawing.x ?? 0, (drawing.x ?? 0) + (drawing.width ?? 0)),
        y: Math.min(drawing.y ?? 0, (drawing.y ?? 0) + (drawing.height ?? 0)),
        width: Math.abs(drawing.width ?? 0),
        height: Math.abs(drawing.height ?? 0),
        label: 'Room',
      }
      onShapesChange?.([...shapes, newShape])
      setSelectedId(newShape.id)
    }
    setDrawing(null)
    setTool('select')
  }, [drawing, readOnly, shapes, onShapesChange, SCALE_X, SCALE_Y])

  const handleDeleteSelected = () => {
    if (!selectedId) return
    onShapesChange?.(shapes.filter(s => s.id !== selectedId))
    setSelectedId(null)
  }

  const handleLabelEdit = (shapeId: string) => {
    const shape = shapes.find(s => s.id === shapeId)
    if (!shape) return
    const newLabel = window.prompt('Room label:', shape.label)
    if (newLabel !== null) {
      onShapesChange?.(shapes.map(s => s.id === shapeId ? { ...s, label: newLabel } : s))
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button
            variant={tool === 'select' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTool('select')}
          >
            <MousePointer2 size={14} /> Select
          </Button>
          <Button
            variant={tool === 'rect' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTool('rect')}
          >
            <Square size={14} /> Draw Room
          </Button>
          {selectedId && (
            <Button variant="ghost" size="sm" onClick={handleDeleteSelected} className="text-accent-rust ml-auto">
              <Trash2 size={14} /> Delete
            </Button>
          )}
        </div>
      )}

      <div
        className="border border-kraft-200 rounded-xl overflow-hidden bg-kraft-50"
        style={{ cursor: tool === 'rect' ? 'crosshair' : 'default' }}
      >
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            {/* Background floor plan image */}
            {bgImage && (
              <KonvaImage
                image={bgImage}
                width={width}
                height={height}
                opacity={0.6}
              />
            )}

            {/* Drawn shapes */}
            {shapes.map(shape => (
              <Group key={shape.id}>
                <Rect
                  x={shape.x * SCALE_X}
                  y={shape.y * SCALE_Y}
                  width={shape.width * SCALE_X}
                  height={shape.height * SCALE_Y}
                  fill={
                    shape.id === selectedId
                      ? 'rgba(74, 51, 32, 0.25)'
                      : selectedRoomId === shape.location_id
                      ? 'rgba(74, 124, 89, 0.25)'
                      : 'rgba(232, 213, 183, 0.5)'
                  }
                  stroke={
                    shape.id === selectedId
                      ? '#4a3320'
                      : selectedRoomId === shape.location_id
                      ? '#4a7c59'
                      : '#d4b896'
                  }
                  strokeWidth={shape.id === selectedId ? 2 : 1}
                  onClick={() => {
                    if (readOnly && shape.location_id) {
                      onRoomClick?.(shape.location_id)
                    } else {
                      setSelectedId(shape.id)
                    }
                  }}
                  onDblClick={() => !readOnly && handleLabelEdit(shape.id)}
                  draggable={!readOnly && tool === 'select'}
                  onDragEnd={(e) => {
                    onShapesChange?.(shapes.map(s =>
                      s.id === shape.id
                        ? { ...s, x: e.target.x() / SCALE_X, y: e.target.y() / SCALE_Y }
                        : s
                    ))
                  }}
                />
                <Text
                  x={shape.x * SCALE_X + 6}
                  y={shape.y * SCALE_Y + 6}
                  text={shape.label}
                  fontSize={11}
                  fill="#4a3320"
                  listening={false}
                />
              </Group>
            ))}

            {/* Active draw preview */}
            {drawing && drawing.width !== undefined && drawing.height !== undefined && (
              <Rect
                x={(drawing.x ?? 0) * SCALE_X}
                y={(drawing.y ?? 0) * SCALE_Y}
                width={(drawing.width ?? 0) * SCALE_X}
                height={(drawing.height ?? 0) * SCALE_Y}
                fill="rgba(74, 51, 32, 0.15)"
                stroke="#4a3320"
                strokeWidth={1}
                dash={[4, 4]}
                listening={false}
              />
            )}

            {/* Room item count pins */}
            {rooms.filter(r => r.item_count && r.item_count > 0).map(room => (
              <Group key={`pin_${room.id}`}>
                <Circle
                  x={(room.x + room.width / 2) * SCALE_X}
                  y={(room.y + room.height / 2) * SCALE_Y}
                  radius={12}
                  fill="#4a3320"
                />
                <Text
                  x={(room.x + room.width / 2) * SCALE_X - 8}
                  y={(room.y + room.height / 2) * SCALE_Y - 6}
                  text={String(room.item_count)}
                  fontSize={10}
                  fill="white"
                  width={16}
                  align="center"
                  listening={false}
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>

      {!readOnly && (
        <p className="text-xs text-kraft-400 text-center">
          {tool === 'rect' ? 'Click and drag to draw a room' : 'Click to select · Double-click to rename · Drag to move'}
        </p>
      )}
    </div>
  )
}
