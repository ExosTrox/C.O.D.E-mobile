import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";

export function Shell() {
  return (
    <div className="flex min-h-screen bg-surface-0">
      <SideNav />
      <main className="flex-1 flex flex-col min-h-screen pb-14 md:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
