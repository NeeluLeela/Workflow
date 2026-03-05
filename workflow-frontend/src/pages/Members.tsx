import { useEffect, useState } from "react";
import api from "../api/api";
import { useTenant } from "../context/TenantContext";

type Member = { id: string; user_id: string; email: string; role: string; created_at: string };

const roleBadge = (role: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: "999px",
  fontSize: "11px",
  fontWeight: 600,
  background: role === "ADMIN" ? "#fef3c7" : role === "APPROVER" ? "#dbeafe" : "#f3f4f6",
  color: role === "ADMIN" ? "#92400e" : role === "APPROVER" ? "#1e40af" : "#374151",
});

const Members = () => {
  const { activeTenant } = useTenant();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"USER" | "APPROVER" | "ADMIN">("USER");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const isAdmin = activeTenant?.role === "ADMIN";

  const fetchMembers = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const res = await api.get(`/tenants/${activeTenant.id}/members`);
      setMembers(res.data);
    } catch {
      setError("Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, [activeTenant?.id]);

  const addMember = async () => {
    if (!email.trim() || !activeTenant) return;
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post(`/tenants/${activeTenant.id}/members`, { email: email.trim(), role });
      setEmail("");
      setSuccess(`${email.trim()} added as ${role}`);
      await fetchMembers();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!activeTenant || !confirm("Remove this member?")) return;
    setError(null);
    try {
      await api.delete(`/tenants/${activeTenant.id}/members/${userId}`);
      await fetchMembers();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to remove member");
    }
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2>Members</h2>
        <p style={styles.sub}>{activeTenant?.name}</p>
      </div>

      {isAdmin && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Invite Member</h3>
          <div style={styles.inviteRow}>
            <input
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              style={styles.input}
            />
            <select value={role} onChange={(e) => setRole(e.target.value as "USER" | "APPROVER" | "ADMIN")} style={styles.select}>
              <option value="USER">USER</option>
              <option value="APPROVER">APPROVER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <button onClick={addMember} disabled={adding || !email.trim()} style={styles.inviteBtn}>
              {adding ? "Adding..." : "Invite"}
            </button>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </div>
      )}

      {loading && <p style={{ color: "#9ca3af" }}>Loading...</p>}

      {members.length > 0 && (
        <div style={styles.tableWrap}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 500 }}>{m.email}</td>
                  <td><span style={roleBadge(m.role)}>{m.role}</span></td>
                  <td style={{ color: "#9ca3af" }}>{new Date(m.created_at).toLocaleDateString()}</td>
                  {isAdmin && (
                    <td>
                      <button onClick={() => removeMember(m.user_id)} style={styles.removeBtn}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && members.length === 0 && (
        <div style={styles.empty}>No members found.</div>
      )}
    </div>
  );
};

export default Members;

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: "24px" },
  sub: { color: "#6b7280", fontSize: "14px" },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "24px",
  },
  cardTitle: { fontSize: "15px", fontWeight: 600, marginBottom: "14px", color: "#111827" },
  inviteRow: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" },
  input: { flex: 1, minWidth: "200px", padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" },
  select: { padding: "9px 12px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" },
  inviteBtn: { padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 500, cursor: "pointer" },
  error: { marginTop: "10px", fontSize: "13px", color: "#dc2626" },
  success: { marginTop: "10px", fontSize: "13px", color: "#16a34a" },
  tableWrap: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" },
  removeBtn: { padding: "4px 10px", background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer", borderRadius: "5px", fontSize: "12px" },
  empty: { padding: "32px", textAlign: "center", color: "#9ca3af", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" },
};
