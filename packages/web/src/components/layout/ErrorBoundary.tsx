import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-bg-primary text-text-primary">
          <AlertTriangle className="h-12 w-12 text-warning mb-4" />
          <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-text-muted text-center mb-6 max-w-sm">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
