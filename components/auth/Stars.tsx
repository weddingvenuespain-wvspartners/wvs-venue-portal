// Deterministic star field — same seed renders the same sky on server and client.
export function Stars({ count = 56, seed = 1 }: { count?: number; seed?: number }) {
  const stars = Array.from({ length: count }, (_, i) => {
    let s = i + seed
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
    return {
      dim: rand() > 0.7,
      warm: rand() > 0.85,
      left: (rand() * 100).toFixed(2),
      top: (rand() * 100).toFixed(2),
      delay: (rand() * 5.5).toFixed(2),
      op: (0.3 + rand() * 0.5).toFixed(2),
    }
  })
  return (
    <>
      {stars.map((st, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: st.left + '%',
            top: st.top + '%',
            width: st.dim ? '1.5px' : '2px',
            height: st.dim ? '1.5px' : '2px',
            borderRadius: '50%',
            background: st.warm ? '#E6C988' : '#fff',
            opacity: parseFloat(st.op),
            boxShadow: st.warm ? '0 0 8px #E6C988' : '0 0 6px rgba(255,255,255,0.6)',
            animation: `fe-twinkle 5.5s ease-in-out ${st.delay}s infinite`,
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  )
}
