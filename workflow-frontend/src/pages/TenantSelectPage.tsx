import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useTenant } from "../context/TenantContext";

type TenantOption = { id: string; name: string; role: string };

const TenantSelect = () => {
  const { selectTenant } = useTenant();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/tenants")
      .then((res) => setTenants(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (tenant: TenantOption) => {
    selectTenant(tenant);
    navigate("/", { replace: true });
  };

  const roleBadgeStyle = (role: string): React.CSSProperties => ({
    padding: "2px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 600,
    background: role === "ADMIN" ? "#fef3c7" : role === "APPROVER" ? "#dbeafe" : "#f3f4f6",
    color: role === "ADMIN" ? "#92400e" : role === "APPROVER" ? "#1e40af" : "#374151",
  });

  if (loading) return (
    <div style={styles.page}>
      <div style={styles.card}>Loading...</div>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={{ marginBottom: "20px" }}>Select a Tenant</h2>

        {tenants.length === 0 && (
          <p style={{ color: "#6b7280" }}>
            You don't belong to any tenant yet. Ask an admin to add you.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {tenants.map((tenant) => (
            <button
              key={tenant.id}
              style={styles.tenantRow}
              onClick={() => handleSelect(tenant)}
            >
              <span style={{ fontWeight: 500 }}>{tenant.name}</span>
              <span style={roleBadgeStyle(tenant.role)}>{tenant.role}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TenantSelect;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f4f6",
  },
  card: {
    background: "#fff",
    borderRadius: "10px",
    padding: "36px",
    width: "460px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  },
  tenantRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    border: "1px solid #e5e7eb",
    borderRadius: "7px",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.15s",
  },
};
