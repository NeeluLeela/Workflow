import { useEffect, useState } from "react";
import api from "../api/api";
import { useTenant } from "../context/TenantContext";
import ApprovalList from "../components/Approvals/ApprovalsList";
import ApprovalActions from "../components/Approvals/ApprovalsActions";

type Approval = {
  id: string;
  item_id: string;
  title: string;
  workflow_name: string;
  current_state: string;
};

const Approvals = () => {
  const { activeTenant } = useTenant();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await api.get("/approvals/pending");
      setApprovals(res.data.data ?? res.data);
    } catch {
      console.error("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setSelected(null); fetchApprovals(); }, [activeTenant?.id]);

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2>Pending Approvals</h2>
        <p style={styles.sub}>Items waiting for your decision.</p>
      </div>

      {loading && <p style={{ color: "#9ca3af" }}>Loading...</p>}

      <ApprovalList approvals={approvals} onSelect={(a) => setSelected(a)} />

      {selected && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelTitle}>{selected.title}</div>
              <div style={styles.panelMeta}>
                {selected.workflow_name} &mdash; state: <strong>{selected.current_state}</strong>
              </div>
            </div>
            <button style={styles.closeBtn} onClick={() => setSelected(null)}>x</button>
          </div>
          <ApprovalActions
            itemId={selected.item_id}
            approvalId={selected.id}
            onDecision={() => { fetchApprovals(); setSelected(null); }}
          />
        </div>
      )}
    </div>
  );
};

export default Approvals;

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: "24px" },
  sub: { color: "#6b7280", fontSize: "14px" },
  panel: {
    marginTop: "24px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
  },
  panelTitle: { fontWeight: 600, fontSize: "16px", marginBottom: "4px" },
  panelMeta: { color: "#6b7280", fontSize: "13px" },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#9ca3af",
    fontSize: "16px",
    padding: "0",
    lineHeight: 1,
  },
};
