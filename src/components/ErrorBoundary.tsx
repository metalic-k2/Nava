import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-12 max-w-xl rounded-lg border border-rose-500/40 bg-arctic-teal p-6 text-crystal-white">
          <p className="font-mono text-xs text-rose-300">Runtime Recovery</p>
          <h2 className="mt-2 font-display text-lg font-semibold">
            Unable to render this observation view
          </h2>
          <p className="mt-2 font-mono text-xs leading-relaxed text-frost-mist">
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, message: '' })}
            className="mt-4 rounded-md bg-crystal-white px-4 py-2 text-xs font-semibold text-glacial-abyss hover:bg-ice-blue"
          >
            Retry View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
