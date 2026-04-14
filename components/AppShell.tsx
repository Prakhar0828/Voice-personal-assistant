"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight, Home, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/", label: "Assistant", icon: Home },
  { href: "/dashboard", label: "Activity dashboard", icon: LayoutDashboard },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  return (
    <div className="flex min-h-[100dvh] w-full flex-1">
      <aside
        className={`sticky top-0 flex h-[100dvh] shrink-0 flex-col border-r border-white/10 bg-zinc-950/95 shadow-[1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-xl transition-[width] duration-200 ease-out ${
          collapsed ? "w-14" : "w-56"
        }`}
        aria-label="Main navigation"
      >
        <div
          className={`flex h-14 shrink-0 items-center border-b border-white/10 px-2 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && (
            <p className="min-w-0 truncate px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Menu
            </p>
          )}
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
            ) : (
              <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-500/30"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${active ? "text-cyan-300" : ""}`}
                  strokeWidth={1.75}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="relative min-h-[100dvh] min-w-0 flex-1">{children}</div>
    </div>
  );
}
