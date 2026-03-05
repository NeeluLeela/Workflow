import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import { useTenant } from "../context/TenantContext";

type Stats = {
  items: number;
  workflows: number;
  pendingApprovals: number;
};

const Dashboard = () => {
  const { user } = useAuth();
  const { activeTenant } = useTenant();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!activeTenant) return;
    Promise.all([
      api.get("/items?limit=1"),
      api.get("/workflows?limit=1"),
      api.get("/approvals/pending?limit=1"),
    ])
      .then(([itemsRes, workflowsRes, approvalsRes]) => {
        setStats({
          items: itemsRes.data.pagination?.total ?? 0,
          workflows: workflowsRes.data.pagination?.total ?? 0,
          pendingApprovals: approvalsRes.data.pagination?.total ?? 0,
        });
      })
      .catch(() => {});
  }, [activeTenant?.id]);

  return (
    <div>
      <div style={styles.welcome}>
        <div style={styles.welcomeText}>
          <h2 style={styles.welcomeHeading}>Welcome back</h2>
          <p style={styles.welcomeSub}>{user?.email}</p>
        </div>
        {activeTenant && (
          <div style={styles.tenantChip}>
            <span style={styles.tenantName}>{activeTenant.name}</span>
            <span style={roleBadge(activeTenant.role)}>{activeTenant.role}</span>
          </div>
        )}
      </div>

      <div style={styles.statsGrid}>
        <StatCard
          label="Items"
          value={stats?.items ?? null}
          to="/items"
          accent="#2563eb"
          desc="workflow items in this tenant"
        />
        <StatCard
          label="Workflows"
          value={stats?.workflows ?? null}
          to="/workflows"
          accent="#7c3aed"
          desc="configured workflow definitions"
        />
        <StatCard
          label="Pending Approvals"
          value={stats?.pendingApprovals ?? null}
          to="/approvals"
          accent={stats && stats.pendingApprovals > 0 ? "#f59e0b" : "#10b981"}
          desc="items waiting for your decision"
          urgent={stats ? stats.pendingApprovals > 0 : false}
        />
      </div>

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Quick navigation</h3>
        <div style={styles.linksGrid}>
          {quickLinks.map((lnk) => (
            <NavLink key={lnk.to} to={lnk.to} style={{ textDecoration: "none" }}>
              <div style={styles.linkCard}>
                <div>
                  <div style={styles.linkLabel}>{lnk.label}</div>
                  <div style={styles.linkDesc}>{lnk.desc}</div>
                </div>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
};

const quickLinks = [
  { to: "/items", label: "Items", desc: "Create and track workflow items" },
  { to: "/workflows", label: "Workflows", desc: "Define states and transitions" },
  { to: "/approvals", label: "Approvals", desc: "Review pending decisions" },
  { to: "/members", label: "Members", desc: "Manage tenant membership" },
  { to: "/audit", label: "Audit Log", desc: "Full history of all events" },
  { to: "/sla", label: "SLA", desc: "Deadlines and escalation rules" },
];

const StatCard = ({
  label,
  value,
  to,
  accent,
  desc,
  urgent,
}: {
  label: string;
  value: number | null;
  to: string;
  accent: string;
  desc: string;
  urgent?: boolean;
}) => (
  <NavLink to={to} style={{ textDecoration: "none", flex: 1, minWidth: "180px" }}>
    <div style={{ ...styles.statCard, borderTop: `3px solid ${accent}`, ...(urgent ? styles.statCardUrgent : {}) }}>
      <div style={{ ...styles.statValue, color: accent }}>
        {value === null ? <span style={styles.statLoading}>—</span> : value}
      </div>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statDesc}>{desc}</div>
    </div>
  </NavLink>
);

const roleBadge = (role: string): React.CSSProperties => ({
  padding: "2px 10px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 600,
  background: role === "ADMIN" ? "#fef3c7" : role === "APPROVER" ? "#dbeafe" : "#f3f4f6",
  color: role === "ADMIN" ? "#92400e" : role === "APPROVER" ? "#1e40af" : "#374151",
});

export default Dashboard;

const styles: Record<string, React.CSSProperties> = {
  welcome: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "28px",
    padding: "20px 24px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
  },
  welcomeText: { display: "flex", flexDirection: "column", gap: "2px" },
  welcomeHeading: { margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" },
  welcomeSub: { margin: 0, fontSize: "13px", color: "#6b7280" },
  tenantChip: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  tenantName: { fontWeight: 600, fontSize: "14px", color: "#111827" },

  statsGrid: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "28px",
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px 22px",
    cursor: "pointer",
    height: "100%",
    boxSizing: "border-box",
  },
  statCardUrgent: {
    background: "#fffbeb",
    borderColor: "#fde68a",
  },
  statValue: {
    fontSize: "36px",
    fontWeight: 700,
    lineHeight: 1,
    marginBottom: "6px",
  },
  statLoading: { color: "#d1d5db", fontSize: "28px" },
  statLabel: { fontSize: "14px", fontWeight: 600, color: "#111827", marginBottom: "4px" },
  statDesc: { fontSize: "12px", color: "#9ca3af" },

  section: { marginTop: "4px" },
  sectionTitle: { fontSize: "14px", fontWeight: 600, color: "#6b7280", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.05em" },

  linksGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: "12px",
  },
  linkCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "14px 16px",
    cursor: "pointer",
  },
  linkLabel: { fontWeight: 600, fontSize: "14px", color: "#111827", marginBottom: "2px" },
  linkDesc: { fontSize: "12px", color: "#9ca3af" },
};
