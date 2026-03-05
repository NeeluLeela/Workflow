import { useState } from "react";

type WorkflowState = { name: string; isInitial: boolean; isFinal: boolean };
type WorkflowTransition = {
  fromState: string;
  toState: string;
  requiresApproval: boolean;
  approvalStrategy: "NONE" | "SINGLE" | "ALL" | "QUORUM";
  requiredApprovals: number;
  requiredRole: string;
};

export type WorkflowPayload = { name: string; states: WorkflowState[]; transitions: WorkflowTransition[] };
type Props = { onCreate: (data: WorkflowPayload) => Promise<void> };

const emptyTransition = (): WorkflowTransition => ({
  fromState: "", toState: "", requiresApproval: false,
  approvalStrategy: "NONE", requiredApprovals: 1, requiredRole: "",
});

const WorkflowForm = ({ onCreate }: Props) => {
  const [name, setName] = useState("");
  const [states, setStates] = useState<WorkflowState[]>([{ name: "", isInitial: true, isFinal: false }]);
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([emptyTransition()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addState = () => setStates([...states, { name: "", isInitial: false, isFinal: false }]);
  const removeState = (i: number) => setStates(states.filter((_, idx) => idx !== i));
  const updateState = (i: number, field: keyof WorkflowState, value: string | boolean) =>
    setStates(states.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  const setInitial = (i: number) =>
    setStates(states.map((s, idx) => ({ ...s, isInitial: idx === i })));

  const addTransition = () => setTransitions([...transitions, emptyTransition()]);
  const removeTransition = (i: number) => setTransitions(transitions.filter((_, idx) => idx !== i));
  const updateTransition = (i: number, field: keyof WorkflowTransition, value: string | boolean | number) =>
    setTransitions(transitions.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));

  const validate = (): string | null => {
    if (name.trim().length < 3) return "Workflow name must be at least 3 characters";
    if (states.length < 2) return "At least 2 states are required";
    if (states.some((s) => s.name.trim().length < 2)) return "Each state name must be at least 2 characters";
    const names = states.map((s) => s.name.trim());
    if (new Set(names).size !== names.length) return "State names must be unique";
    if (!states.some((s) => s.isFinal)) return "At least one state must be marked as Final";
    for (let i = 0; i < transitions.length; i++) {
      const t = transitions[i];
      if (!t.fromState || !t.toState) return `Transition ${i + 1}: select both From and To states`;
      if (t.fromState === t.toState) return `Transition ${i + 1}: From and To states must be different`;
      if (t.requiresApproval && !t.requiredRole) return `Transition ${i + 1}: select a Role when approval is required`;
      if (t.requiresApproval && t.approvalStrategy === "QUORUM" && t.requiredApprovals < 1)
        return `Transition ${i + 1}: required approvals must be at least 1 for Quorum`;
    }
    return null;
  };

  const parseApiError = (err: unknown): string => {
    const resp = (err as { response?: { data?: { message?: string; details?: { formErrors?: string[]; fieldErrors?: Record<string, string[]> } } } })?.response?.data;
    if (resp?.details) {
      const msgs: string[] = [...(resp.details.formErrors ?? [])];
      if (resp.details.fieldErrors) {
        for (const [, errs] of Object.entries(resp.details.fieldErrors)) {
          msgs.push(...errs);
        }
      }
      if (msgs.length > 0) return msgs.join(". ");
    }
    return resp?.message ?? "Failed to create workflow";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);
    try {
      await onCreate({ name, states, transitions });
      setName("");
      setStates([{ name: "", isInitial: true, isFinal: false }]);
      setTransitions([emptyTransition()]);
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const stateNames = states.map((s) => s.name).filter(Boolean);

  return (
    <form onSubmit={handleSubmit} style={styles.card}>
      <h3 style={styles.cardTitle}>Create Workflow</h3>

      <div style={styles.field}>
        <label style={styles.label}>Workflow name</label>
        <input
          type="text"
          placeholder="e.g. Document Approval"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          required
        />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionLabel}>States</span>
          <button type="button" onClick={addState} style={styles.addBtn}>+ Add State</button>
        </div>
        {states.map((s, i) => (
          <div key={i} style={styles.stateRow}>
            <input
              type="text"
              placeholder="State name"
              value={s.name}
              onChange={(e) => updateState(i, "name", e.target.value)}
              style={{ ...styles.input, flex: 1 }}
              required
            />
            <label style={styles.checkLabel}>
              <input type="radio" name="initial" checked={s.isInitial} onChange={() => setInitial(i)} />
              Initial
            </label>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={s.isFinal} onChange={(e) => updateState(i, "isFinal", e.target.checked)} />
              Final
            </label>
            {states.length > 1 && (
              <button type="button" onClick={() => removeState(i)} style={styles.removeBtn}>x</button>
            )}
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionLabel}>Transitions</span>
          <button type="button" onClick={addTransition} style={styles.addBtn}>+ Add Transition</button>
        </div>
        {transitions.map((t, i) => (
          <div key={i} style={styles.transitionRow}>
            <select value={t.fromState} onChange={(e) => updateTransition(i, "fromState", e.target.value)} style={styles.select}>
              <option value="">From</option>
              {stateNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span style={styles.arrow}>&gt;</span>
            <select value={t.toState} onChange={(e) => updateTransition(i, "toState", e.target.value)} style={styles.select}>
              <option value="">To</option>
              {stateNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={t.requiresApproval}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTransitions(transitions.map((tr, idx) =>
                    idx === i ? { ...tr, requiresApproval: checked, approvalStrategy: checked ? "SINGLE" : "NONE" } : tr
                  ));
                }}
              />
              Needs approval
            </label>
            {t.requiresApproval && (
              <>
                <select value={t.approvalStrategy} onChange={(e) => updateTransition(i, "approvalStrategy", e.target.value)} style={styles.select}>
                  <option value="SINGLE">Single</option>
                  <option value="ALL">All</option>
                  <option value="QUORUM">Quorum</option>
                </select>
                {t.approvalStrategy === "QUORUM" && (
                  <input type="number" min={1} value={t.requiredApprovals} onChange={(e) => updateTransition(i, "requiredApprovals", parseInt(e.target.value))} style={{ ...styles.input, width: "60px" }} />
                )}
                <select value={t.requiredRole} onChange={(e) => updateTransition(i, "requiredRole", e.target.value)} style={styles.select}>
                  <option value="">Role</option>
                  <option value="APPROVER">APPROVER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </>
            )}
            {transitions.length > 1 && (
              <button type="button" onClick={() => removeTransition(i)} style={styles.removeBtn}>x</button>
            )}
          </div>
        ))}
      </div>

      {error && <p style={styles.error}>{error}</p>}

      <button type="submit" disabled={loading} style={styles.submitBtn}>
        {loading ? "Creating..." : "Create Workflow"}
      </button>
    </form>
  );
};

export default WorkflowForm;

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  cardTitle: { fontSize: "15px", fontWeight: 600, color: "#111827", margin: 0 },
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "13px", fontWeight: 500, color: "#374151" },
  input: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px" },
  select: { padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "14px", minWidth: "130px" },
  section: { display: "flex", flexDirection: "column", gap: "8px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sectionLabel: { fontWeight: 600, fontSize: "13px", color: "#374151" },
  addBtn: { padding: "4px 10px", border: "1px solid #d1d5db", borderRadius: "5px", background: "#fff", fontSize: "12px", cursor: "pointer" },
  stateRow: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
  transitionRow: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", background: "#f9fafb", padding: "10px", borderRadius: "6px" },
  checkLabel: { display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#374151" },
  arrow: { color: "#9ca3af", fontWeight: 600, fontSize: "16px" },
  removeBtn: { background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "14px", padding: "0 4px" },
  submitBtn: { alignSelf: "flex-start", padding: "9px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "14px", cursor: "pointer" },
  error: { margin: 0, padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", color: "#dc2626", fontSize: "13px" },
};
