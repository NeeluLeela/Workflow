import { useEffect, useState } from "react";
import api from "../api/api";
import { useTenant } from "../context/TenantContext";

type SlaRule = { id: string; workflow_id: string; workflow_name: string; state_id: string; state_name: string; deadline_hours: number; escalation_role: string };
type SlaBreach = { id: string; item_id: string; item_title: string; state_name: string; deadline_hours: number; escalation_role: string; breached_at: string; escalated: boolean; escalated_at: string | null };
type Workflow = { id: string; name: string };
type WorkflowState = { id: string; name: string };

const SLA = () => {
  const { activeTenant } = useTenant();
  const isAdmin = activeTenant?.role === "ADMIN";

  const [rules, setRules] = useState<SlaRule[]>([]);
  const [breaches, setBreaches] = useState<SlaBreach[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [workflowId, setWorkflowId] = useState("");
  const [stateId, setStateId] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [escalationRole, setEscalationRole] = useState<"ADMIN" | "APPROVER">("ADMIN");
  const [adding, setAdding] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rulesRes, breachesRes, wfRes] = await Promise.all([
        api.get("/sla/rules"),
        api.get("/sla/breaches"),
        api.get("/workflows"),
      ]);
      setRules(rulesRes.data.data ?? rulesRes.data);
      setBreaches(breachesRes.data.data ?? breachesRes.data);
      setWorkflows(Array.isArray(wfRes.data) ? wfRes.data : (wfRes.data.data ?? []));
    } catch {
      setError("Failed to load SLA data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [activeTenant?.id]);

  useEffect(() => {
    if (!workflowId) { setStates([]); setStateId(""); return; }
    api.get(`/workflows/${workflowId}`).then((res) => { setStates(res.data.states ?? []); setStateId(""); }).catch(() => {});
  }, [workflowId]);

  const addRule = async () => {
    if (!workflowId || !stateId) return;
    setAdding(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post("/sla/rules", { workflowId, stateId, deadlineHours, escalationRole });
      setSuccess("SLA rule saved");
      setWorkflowId(""); setStateId(""); setDeadlineHours(24);
      await fetchAll();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save rule");
    } finally {
      setAdding(false);
    }
  };

  const deleteRule = async (id: string) => {
    setError(null);
    try { await api.delete(`/sla/rules/${id}`); await fetchAll(); }
    catch { setError("Failed to delete rule"); }
  };

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2>SLA & Escalation</h2>
        <p style={styles.sub}>Define deadlines and automatic escalation rules.</p>
      </div>

      {isAdmin && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Configure Rule</h3>
          <div style={styles.ruleRow}>
            <div style={styles.field}>
              <label style={styles.label}>Workflow</label>
              <select value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} style={styles.select}>
                <option value="">Select workflow</option>
                {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>State</label>
              <select value={stateId} onChange={(e) => setStateId(e.target.value)} style={styles.select} disabled={!workflowId}>
                <option value="">Select state</option>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Deadline (hours)</label>
              <input type="number" min={1} value={deadlineHours} onChange={(e) => setDeadlineHours(Number(e.target.value))} style={{ ...styles.select, width: "90px" }} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Escalate to</label>
              <select value={escalationRole} onChange={(e) => setEscalationRole(e.target.value as "ADMIN" | "APPROVER")} style={styles.select}>
                <option value="ADMIN">ADMIN</option>
                <option value="APPROVER">APPROVER</option>
              </select>
            </div>
            <div style={{ alignSelf: "flex-end" }}>
              <button onClick={addRule} disabled={adding || !workflowId || !stateId} style={styles.saveBtn}>
                {adding ? "Saving..." : "Save Rule"}
              </button>
            </div>
          </div>
          {error && <p style={styles.error}>{error}</p>}
          {success && <p style={styles.success}>{success}</p>}
        </div>
      )}

      {loading && <p style={{ color: "#9ca3af" }}>Loading...</p>}

      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Active Rules</h3>
        {rules.length === 0 ? (
          <div style={styles.empty}>No SLA rules configured.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>State</th>
                  <th>Deadline</th>
                  <th>Escalate to</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{r.workflow_name}</td>
                    <td>{r.state_name}</td>
                    <td><span style={styles.hourBadge}>{r.deadline_hours}h</span></td>
                    <td><span style={styles.roleBadge}>{r.escalation_role}</span></td>
                    {isAdmin && <td><button onClick={() => deleteRule(r.id)} style={styles.deleteBtn}>Delete</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ ...styles.section, marginTop: "28px" }}>
        <h3 style={styles.sectionTitle}>
          Breaches
          {breaches.length > 0 && <span style={styles.countBadge}>{breaches.length}</span>}
        </h3>
        {breaches.length === 0 ? (
          <div style={styles.empty}>No SLA breaches detected.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>State</th>
                  <th>Deadline</th>
                  <th>Breached At</th>
                  <th>Escalation</th>
                </tr>
              </thead>
              <tbody>
                {breaches.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500 }}>{b.item_title}</td>
                    <td>{b.state_name}</td>
                    <td><span style={styles.hourBadge}>{b.deadline_hours}h</span></td>
                    <td style={{ color: "#9ca3af" }}>{new Date(b.breached_at).toLocaleString()}</td>
                    <td>
                      {b.escalated ? (
                        <span style={styles.escalatedBadge}>Escalated</span>
                      ) : (
                        <span style={styles.pendingBadge}>Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SLA;

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: "24px" },
  sub: { color: "#6b7280", fontSize: "14px" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "20px", marginBottom: "28px" },
  cardTitle: { fontSize: "15px", fontWeight: 600, marginBottom: "16px", color: "#111827" },
  ruleRow: { display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "flex-end" },
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "12px", fontWeight: 500, color: "#374151" },
  select: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", minWidth: "150px" },
  saveBtn: { padding: "9px 18px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 500, cursor: "pointer" },
  error: { marginTop: "10px", fontSize: "13px", color: "#dc2626" },
  success: { marginTop: "10px", fontSize: "13px", color: "#16a34a" },
  section: {},
  sectionTitle: { fontSize: "15px", fontWeight: 600, marginBottom: "12px", color: "#374151", display: "flex", alignItems: "center", gap: "8px" },
  tableWrap: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" },
  empty: { padding: "28px", textAlign: "center", color: "#9ca3af", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" },
  hourBadge: { display: "inline-block", padding: "2px 8px", borderRadius: "999px", background: "#f3f4f6", color: "#374151", fontSize: "12px", fontWeight: 600 },
  roleBadge: { display: "inline-block", padding: "2px 8px", borderRadius: "999px", background: "#dbeafe", color: "#1e40af", fontSize: "12px", fontWeight: 600 },
  countBadge: { background: "#dc2626", color: "#fff", borderRadius: "999px", padding: "1px 8px", fontSize: "12px", fontWeight: 600 },
  deleteBtn: { padding: "4px 10px", background: "#fee2e2", color: "#991b1b", border: "none", cursor: "pointer", borderRadius: "5px", fontSize: "12px" },
  escalatedBadge: { display: "inline-block", padding: "2px 8px", background: "#dcfce7", color: "#166534", borderRadius: "999px", fontSize: "12px", fontWeight: 600 },
  pendingBadge: { display: "inline-block", padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: "999px", fontSize: "12px", fontWeight: 600 },
};
