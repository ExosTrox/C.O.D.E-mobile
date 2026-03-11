import { Terminal } from "lucide-react";

export function Header({ title }: { title: string }) {
  return (
    <header className="flex items-center gap-3 px-5 h-14 border-b border-white/[0.04] glass-surface safe-top md:hidden">
      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-accent/15 via-accent/8 to-transparent flex items-center justify-center border border-accent/10">
        <Terminal className="h-3.5 w-3.5 text-accent" />
      </div>
      <h1 className="font-bold text-text-primary text-[15px] tracking-tight">{title}</h1>
    </header>
  );
}
