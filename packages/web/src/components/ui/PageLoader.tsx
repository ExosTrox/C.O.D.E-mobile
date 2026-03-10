import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-0">
      <Loader2 className="h-6 w-6 text-accent animate-spin" />
    </div>
  );
}
