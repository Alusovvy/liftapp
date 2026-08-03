import type { ReactNode } from "react";

export type PrimaryView = "today" | "train" | "progress" | "body" | "library" | "settings";

type AppShellProps = {
  activeView: PrimaryView;
  athleteName: string;
  onNavigate: (view: PrimaryView) => void;
  children: ReactNode;
};

const navigation: Array<{
  id: Exclude<PrimaryView, "settings">;
  label: string;
  icon: string;
}> = [
  { id: "today", label: "Today", icon: "●" },
  { id: "train", label: "Train", icon: "↗" },
  { id: "progress", label: "Progress", icon: "⌁" },
  { id: "body", label: "Body & nutrition", icon: "◇" },
  { id: "library", label: "Library", icon: "▦" },
];

export function AppShell({
  activeView,
  athleteName,
  onNavigate,
  children,
}: AppShellProps) {
  return (
    <div className="modern-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="app-rail" aria-label="Primary">
        <button
          className="brand-button"
          type="button"
          onClick={() => onNavigate("today")}
          aria-label="Liftwise home"
        >
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>Liftwise</span>
        </button>
        <nav className="primary-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className="primary-nav-item"
              type="button"
              aria-current={activeView === item.id ? "page" : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-symbol" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-footer">
          <button
            type="button"
            className="profile-button"
            aria-current={activeView === "settings" ? "page" : undefined}
            onClick={() => onNavigate("settings")}
          >
            <span className="avatar" aria-hidden="true">
              {athleteName.trim().charAt(0).toUpperCase() || "A"}
            </span>
            <span>
              <strong>{athleteName}</strong>
              <small>Settings & data</small>
            </span>
          </button>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="modern-topbar">
          <button
            className="mobile-brand"
            type="button"
            onClick={() => onNavigate("today")}
          >
            Liftwise
          </button>
          <p>Saved on this device</p>
          <a className="legacy-link" href="./index.html">
            Open current workout logger
          </a>
        </header>
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
