'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[NeuralSeed] Unhandled error:', error)
  }, [error])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#050505', color: '#fff', fontFamily: 'sans-serif', gap: 16, padding: 32,
    }}>
      <div style={{ fontSize: 36 }}>⚠</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Something went wrong</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 380, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
        {error.message || 'An unexpected error occurred in the dashboard.'}
      </p>
      {error.digest && (
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>ref: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 10,
          background: '#E85D64', border: 'none', color: '#fff',
          fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}
