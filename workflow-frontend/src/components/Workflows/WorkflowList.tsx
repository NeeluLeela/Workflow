import { useState } from "react";
import api from "../../api/api";
import { useTenant } from "../../context/TenantContext";

type Workflow = {
  id: string;
  name: string;
  version: number;
  is_active: boolean;
  created_at: string;
};

type Props = {
  workflows: Workflow[];
  onUpdate: () => void;
};

const WorkflowList = ({ workflows, onUpdate }: Props) => {
  const { activeTenant } = useTenant();
  const isAdmin = activeTenant?.role === "ADMIN";
  const [error, setError] = useState<string | null>(null);

  const deactivate = async (id: string) => {
    if (!confirm("Deactivate this workflow? Existing items will not be affected.")) return;
    setError(null);
    try {
      await api.patch(`/workflows/${id}/deactivate`);
      onUpdate();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to deactivate workflow");
    }
  };

  if (workflows.length === 0) {
    return (
      <div style={styles.empty}>No workflows yet. Create one above.</div>
    );
  }

  return (
    <div>
      {error && <p style={styles.error}>{error}</p>}
      <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Version</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Created</th>
            {isAdmin && <th style={styles.th}></th>}
          </tr>
        </thead>
        <tbody>
          {workflows.map((wf) => (
            <tr key={wf.id}>
              <td style={{ ...styles.td, fontWeight: 500 }}>{wf.name}</td>
              <td style={styles.td}>
                <span style={styles.versionBadge}>v{wf.version}</span>
              </td>
              <td style={styles.td}>
                <span style={wf.is_active ? styles.active : styles.inactive}>
                  {wf.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td style={{ ...styles.td, color: "#9ca3af" }}>{new Date(wf.created_at).toLocaleDateString()}</td>
              {isAdmin && (
                <td style={styles.td}>
                  {wf.is_active && (
                    <button onClick={() => deactivate(wf.id)} style={styles.deactivateBtn}>
                      Deactivate
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};

export default WorkflowList;

const styles: Record<string, React.CSSProperties> = {
  tableWrap: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "14px",
  },
  th: {
    textAlign: "left",
    padding: "11px 14px",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 600,
    fontSize: "12px",
    color: "#6b7280",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    background: "#f9fafb",
  },
  td: {
    padding: "12px 14px",
    borderBottom: "1px solid #f3f4f6",
  },
  versionBadge: {
    display: "inline-block",
    padding: "2px 7px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 600,
  },
  active: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#166534",
    fontSize: "12px",
    fontWeight: 600,
  },
  inactive: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "999px",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "12px",
    fontWeight: 600,
  },
  deactivateBtn: {
    padding: "4px 10px",
    background: "#fee2e2",
    color: "#991b1b",
    border: "none",
    cursor: "pointer",
    borderRadius: "5px",
    fontSize: "12px",
  },
  empty: {
    padding: "32px",
    textAlign: "center",
    color: "#9ca3af",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "14px",
  },
  error: {
    margin: "0 0 10px 0",
    padding: "10px 12px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "6px",
    color: "#dc2626",
    fontSize: "13px",
  },
};
