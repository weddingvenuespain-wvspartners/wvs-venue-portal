'use client'

type Props = {
  size?: number
  color?: string
  thickness?: number
  style?: React.CSSProperties
}

export default function Spinner({ size = 24, color = 'var(--gold)', thickness = 2, style }: Props) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      style={{
        width: size,
        height: size,
        border: `${thickness}px solid ${color}`,
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        ...style,
      }}
    />
  )
}

export function PageSpinner({ minHeight = '100vh', background }: { minHeight?: string | number; background?: string }) {
  return (
    <div style={{ minHeight, background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )
}
