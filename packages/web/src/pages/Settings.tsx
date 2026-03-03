import { Header } from "../components/layout/Header";
import { Settings } from "lucide-react";

export function SettingsPage() {
  return (
    <>
      <Header title="Settings" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Settings className="h-7 w-7 text-accent" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <p className="text-sm text-text-muted max-w-xs">
            App configuration and preferences.
          </p>
        </div>
      </div>
    </>
  );
}
