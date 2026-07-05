import { Fish, Waves, Bird, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react'
import React from 'react'

export interface ClassMeta {
  name: string
  label: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> // 👈 style desteğini ekledik
  color: string
}
export const CLASSES: ClassMeta[] = [
  { name: 'fish', label: 'Balık', icon: Fish, color: 'var(--chart-1)' },
  { name: 'jellyfish', label: 'Denizanası', icon: Waves, color: 'var(--chart-2)' }, // Temsili dalga/denizanası
  { name: 'penguin', label: 'Penguen', icon: Bird, color: 'var(--chart-3)' },
  { name: 'puffin', label: 'Puffin', icon: Bird, color: 'var(--chart-4)' },
  { name: 'shark', label: 'Köpekbalığı', icon: ShieldAlert, color: 'var(--chart-5)' }, // Tehlike/Köpekbalığı
  { name: 'starfish', label: 'Deniz Yıldızı', icon: Sparkles, color: 'var(--destructive)' },
  { name: 'stingray', label: 'Vatoz', icon: Waves, color: 'var(--chart-6)' },
]

export const CLASS_MAP: Record<string, ClassMeta> = Object.fromEntries(
  CLASSES.map((c) => [c.name, c]),
)

export function getClassMeta(name: string): ClassMeta {
  return CLASS_MAP[name] ?? {
    name,
    label: name,
    icon: HelpCircle,
    color: 'var(--muted-foreground)',
  }
}