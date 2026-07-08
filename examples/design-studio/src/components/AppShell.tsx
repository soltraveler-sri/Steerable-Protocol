import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useDesignStudio } from "../state/designStore";
import { SteeringPanel } from "./SteeringPanel";

const navItems = [
  { to: "/", label: "Editor", end: true },
  { to: "/templates", label: "Templates" },
  { to: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useDesignStudio();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Design Studio</p>
          <h1>{state.projectMeta.name}</h1>
        </div>
        <div className="topbar-meta" aria-label="Project status">
          <span>{state.activeTemplateId.replaceAll("-", " ")}</span>
          <strong>
            {state.exportQuota.remaining}/{state.exportQuota.limit} exports
          </strong>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Primary">
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="workspace-main">{children}</main>
        <SteeringPanel />
      </div>
    </div>
  );
}
