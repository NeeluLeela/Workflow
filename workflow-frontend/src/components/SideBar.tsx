import { NavLink } from "react-router-dom";

const navGroups: { label: string; items: { to: string; label: string; exact?: boolean }[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", exact: true },
    ],
  },
  {
    label: "Work",
    items: [
      { to: "/items", label: "Items" },
      { to: "/approvals", label: "Approvals" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { to: "/workflows", label: "Workflows" },
      { to: "/sla", label: "SLA" },
      { to: "/members", label: "Members" },
    ],
  },
  {
    label: "Logs",
    items: [
      { to: "/audit", label: "Audit Log" },
    ],
  },
];

const Sidebar = () => {
  return (
    <aside style={styles.sidebar}>
      {navGroups.map((group) => (
        <div key={group.label} style={styles.group}>
          <div style={styles.groupLabel}>{group.label}</div>
          {group.items.map(({ to, label, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive ? styles.activeLink : {}),
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  );
};

export default Sidebar;

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: "210px",
    minWidth: "210px",
    background: "#fff",
    borderRight: "1px solid #e5e7eb",
    padding: "16px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    minHeight: "calc(100vh - 56px)",
  },
  group: {
    marginBottom: "20px",
  },
  groupLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    padding: "0 10px",
    marginBottom: "4px",
  },
  link: {
    display: "block",
    padding: "8px 12px",
    borderRadius: "6px",
    color: "#374151",
    fontWeight: 500,
    fontSize: "14px",
    textDecoration: "none",
  },
  activeLink: {
    background: "#eff6ff",
    color: "#2563eb",
  },
};
