'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unknown error' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[NeuralSeed] ${this.props.label ?? 'Component'} crashed:`, error, info.componentStack)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          flex: 1, gap: 12, padding: 32, textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>
            {this.props.label ?? 'This section'} encountered an error
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', maxWidth: 320, lineHeight: 1.5 }}>
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
