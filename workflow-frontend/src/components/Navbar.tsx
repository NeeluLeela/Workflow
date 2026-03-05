import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTenant } from "../context/TenantContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const { activeTenant, clearTenant } = useTenant();
  const navigate = useNavigate();

  return (
    <header style={styles.navbar}>
      <div style={styles.brand}>Workflow Engine</div>

      <div style={styles.right}>
        {activeTenant && (
          <div style={styles.tenantBadge}>
            <span style={styles.tenantName}>{activeTenant.name}</span>
            <span style={styles.tenantRole}>{activeTenant.role}</span>
          </div>
        )}
        <span style={styles.email}>{user?.email}</span>
        <button
          style={styles.switchBtn}
          onClick={() => {
            clearTenant();
            navigate("/select-tenant");
          }}
        >
          Switch
        </button>
        <button style={styles.logoutBtn} onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
};

export default Navbar;

const styles: Record<string, React.CSSProperties> = {
  navbar: {
    height: "56px",
    background: "#111827",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 24px",
    position: "sticky",
    top: 0,
    zIndex: 100,
    borderBottom: "1px solid #1f2937",
  },
  brand: {
    fontWeight: 700,
    fontSize: "15px",
    color: "#f9fafb",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  tenantBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    background: "#1f2937",
    borderRadius: "6px",
    border: "1px solid #374151",
  },
  tenantName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#e5e7eb",
  },
  tenantRole: {
    fontSize: "11px",
    color: "#9ca3af",
    fontWeight: 500,
  },
  email: {
    fontSize: "13px",
    color: "#6b7280",
  },
  switchBtn: {
    padding: "5px 12px",
    background: "transparent",
    color: "#d1d5db",
    border: "1px solid #374151",
    borderRadius: "5px",
    fontSize: "12px",
    cursor: "pointer",
  },
  logoutBtn: {
    padding: "5px 12px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: 500,
  },
};
