export interface DragPoint {
  x: number
  y: number
}

export function calculateWidgetDragPosition(
  windowOrigin: DragPoint,
  pointerOrigin: DragPoint,
  pointerCurrent: DragPoint
): DragPoint {
  return {
    x: Math.round(windowOrigin.x + pointerCurrent.x - pointerOrigin.x),
    y: Math.round(windowOrigin.y + pointerCurrent.y - pointerOrigin.y)
  }
}
