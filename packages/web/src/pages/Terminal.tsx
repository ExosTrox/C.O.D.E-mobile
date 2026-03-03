import { Header } from "../components/layout/Header";

export function TerminalPage() {
  return (
    <>
      <Header title="Terminal" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <span className="text-2xl font-mono text-accent">{">"}_</span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Terminal</h2>
          <p className="text-sm text-text-muted max-w-xs">
            Start a session to see your AI coding agent here.
          </p>
        </div>
      </div>
    </>
  );
}
