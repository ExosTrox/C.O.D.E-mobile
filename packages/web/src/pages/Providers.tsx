import { Header } from "../components/layout/Header";
import { Box } from "lucide-react";

export function ProvidersPage() {
  return (
    <>
      <Header title="Providers" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Box className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">
            Providers
          </h2>
          <p className="text-sm text-text-muted max-w-xs">
            Configure your AI coding agent providers.
          </p>
        </div>
      </div>
    </>
  );
}
