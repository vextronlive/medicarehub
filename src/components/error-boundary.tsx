"use client"

import { Component, type ReactNode } from "react"

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-red-50 p-6">
          <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold text-red-700">
              Render Error (debug)
            </h2>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-900">
              {this.state.error?.message}
              {"\n\n"}
              {this.state.error?.stack}
            </pre>
            <button
              className="mt-4 rounded bg-red-600 px-4 py-2 text-sm text-white"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
