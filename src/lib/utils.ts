import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 0..1 as a whole percentage, e.g. 0.32 -> "32%". */
export const pct = (p: number) => `${Math.round(p * 100)}%`
