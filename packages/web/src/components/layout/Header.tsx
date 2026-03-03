import { Terminal } from "lucide-react";

export function Header({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 px-4 h-14 border-b border-border bg-surface-1/80 backdrop-blur-xl safe-top md:hidden">
      <div className="h-7 w-7 rounded-lg bg-accent/20 flex items-center justify-center">
        <Terminal className="h-4 w-4 text-accent" />
      </div>
      <h1 className="font-semibold text-text-primary text-sm">{title}</h1>
    </header>
  );
}
