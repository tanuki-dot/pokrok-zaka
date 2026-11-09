import { Component, type ReactNode } from 'react'
import { AppError } from '../pages/ErrorPage'

// Zachytí neočekávané chyby při vykreslování a místo bílé obrazovky
// ukáže chybovou stránku (500) s možností stránku obnovit.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Nezachycená chyba aplikace:', error)
  }

  render() {
    return this.state.failed ? <AppError /> : this.props.children
  }
}
