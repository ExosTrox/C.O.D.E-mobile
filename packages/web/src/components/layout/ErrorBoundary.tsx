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
    // If the error is a MIME/module loading issue, force a clean reload
    // to bust stale service worker caches
    const msg = this.state.error?.message ?? "";
    if (msg.includes("MIME") || msg.includes("module") || msg.includes("text/html")) {
      // Unregister service workers to clear stale cache, then hard reload
      navigator.serviceWorker?.getRegistrations().then((regs) => {
        for (const r of regs) r.unregister();
        window.location.reload();
      }).catch(() => window.location.reload());
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-surface-0 text-text-primary">
          <AlertTriangle className="h-12 w-12 text-warning mb-4" />
          <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-sm text-text-muted text-center mb-6 max-w-sm">
            {this.state.error?.message ?? "An unexpected error occurred"}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-all active:scale-[0.97]"
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
