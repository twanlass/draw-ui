export interface InkPoint {
  x: number
  y: number
  z?: number
}

export interface InkOptions {
  size?: number
  thinning?: number
  smoothing?: number
  streamline?: number
  simulatePressure?: boolean
  last?: boolean
}

export function svgInk(points: InkPoint[], options?: InkOptions): string
