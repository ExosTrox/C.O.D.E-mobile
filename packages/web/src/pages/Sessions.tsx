import { Header } from "../components/layout/Header";
import { Layers } from "lucide-react";

export function SessionsPage() {
  return (
    <>
      <Header title="Sessions" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Layers className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Sessions</h2>
          <p className="text-sm text-text-muted max-w-xs">
            No active sessions. Create one to get started.
          </p>
        </div>
      </div>
    </>
  );
}
