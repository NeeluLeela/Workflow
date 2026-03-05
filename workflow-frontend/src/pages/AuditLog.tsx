import { useEffect, useState, useCallback } from "react";
import api from "../api/api";
import { useTenant } from "../context/TenantContext";

type AuditEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  item_title: string | null;
  action_type: string;
  performed_by_email: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_TYPES = ["CREATED","STATE_CHANGED","APPROVAL_REQUESTED","APPROVED","REJECTED","DELEGATED","SLA_BREACHED","SLA_ESCALATED"];

const actionStyle = (action: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    CREATED: { background: "#d1fae5", color: "#065f46" },
    STATE_CHANGED: { background: "#dbeafe", color: "#1e40af" },
    APPROVAL_REQUESTED: { background: "#fef3c7", color: "#92400e" },
    APPROVED: { background: "#d1fae5", color: "#065f46" },
    REJECTED: { background: "#fee2e2", color: "#991b1b" },
    DELEGATED: { background: "#ede9fe", color: "#5b21b6" },
    SLA_BREACHED: { background: "#fee2e2", color: "#991b1b" },
    SLA_ESCALATED: { background: "#fef3c7", color: "#92400e" },
  };
  return map[action] ?? { background: "#f3f4f6", color: "#374151" };
};

const AuditLog = () => {
  const { activeTenant } = useTenant();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterItemId, setFilterItemId] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const limit = 20;

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: p, limit };
      if (filterItemId.trim()) params.itemId = filterItemId.trim();
      if (filterAction) params.actionType = filterAction;
      const res = await api.get("/items/audit", { params });
      const payload = res.data;
      setLogs(payload.data ?? payload);
      setTotal(payload.pagination?.total ?? (payload.data ?? payload).length);
    } catch {
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [filterItemId, filterAction]);

  useEffect(() => { setFilterItemId(""); setFilterAction(""); setPage(1); fetchLogs(1); }, [activeTenant?.id]);

  const handleSearch = () => { setPage(1); fetchLogs(1); };
  const handlePage = (next: number) => { setPage(next); fetchLogs(next); };
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2>Audit Log</h2>
        <p style={styles.sub}>Full history of all events in this tenant.</p>
      </div>

      <div style={styles.filterCard}>
        <input
          type="text"
          placeholder="Filter by Item ID"
          value={filterItemId}
          onChange={(e) => setFilterItemId(e.target.value)}
          style={styles.input}
        />
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={styles.select}>
          <option value="">All Actions</option>
          {ACTION_TYPES.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
        <button onClick={handleSearch} disabled={loading} style={styles.searchBtn}>
          {loading ? "Loading…" : "Search"}
        </button>
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

      <div style={{ marginBottom: "10px", color: "#9ca3af", fontSize: "13px" }}>{total} entries</div>

      {logs.length === 0 && !loading ? (
        <div style={styles.empty}>No audit entries found.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Item</th>
                <th>Action</th>
                <th>By</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {entry.item_title ?? <span style={{ color: "#9ca3af" }}>{entry.entity_id.slice(0, 8)}…</span>}
                  </td>
                  <td>
                    <span style={{ ...styles.badge, ...actionStyle(entry.action_type) }}>
                      {entry.action_type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ color: "#6b7280" }}>{entry.performed_by_email ?? "—"}</td>
                  <td style={{ color: "#9ca3af", fontSize: "12px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button disabled={page <= 1} onClick={() => handlePage(page - 1)} style={styles.pageBtn}>Prev</button>
          <span style={{ margin: "0 14px", fontSize: "13px", color: "#6b7280" }}>Page {page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => handlePage(page + 1)} style={styles.pageBtn}>Next</button>
        </div>
      )}
    </div>
  );
};

export default AuditLog;

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: "24px" },
  sub: { color: "#6b7280", fontSize: "14px" },
  filterCard: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  },
  input: { flex: 1, minWidth: "200px", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" },
  select: { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" },
  searchBtn: { padding: "8px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "14px", cursor: "pointer" },
  tableWrap: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" },
  empty: { padding: "32px", textAlign: "center", color: "#9ca3af", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600 },
  pagination: { display: "flex", alignItems: "center", justifyContent: "center", marginTop: "20px" },
  pageBtn: { padding: "7px 16px", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer", background: "#fff", fontSize: "13px" },
};
