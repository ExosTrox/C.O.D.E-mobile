import { Terminal } from "lucide-react";

export function Header({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.04] bg-surface-0/80 backdrop-blur-2xl safe-top md:hidden">
      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center border border-accent/10">
        <Terminal className="h-3.5 w-3.5 text-accent" />
      </div>
      <h1 className="font-semibold text-text-primary text-sm tracking-tight">{title}</h1>
    </header>
  );
}
