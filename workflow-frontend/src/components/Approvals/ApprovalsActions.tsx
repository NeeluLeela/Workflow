import { useEffect, useState } from "react";
import api from "../../api/api";
import { useTenant } from "../../context/TenantContext";

type Member = { user_id: string; email: string; role: string };
type Props = { itemId: string; approvalId: string; onDecision: () => void };

const ApprovalActions = ({ itemId, approvalId, onDecision }: Props) => {
  const { activeTenant } = useTenant();
  const [loading, setLoading] = useState(false);
  const [delegateTo, setDelegateTo] = useState("");
  const [showDelegate, setShowDelegate] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showDelegate || !activeTenant) return;
    api.get(`/tenants/${activeTenant.id}/members`).then((res) => setMembers(res.data)).catch(() => {});
  }, [showDelegate, activeTenant?.id]);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/items/${itemId}/approve`, { decision });
      onDecision();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Decision failed");
    } finally {
      setLoading(false);
    }
  };

  const delegate = async () => {
    if (!delegateTo) return;
    setLoading(true);
    setError(null);
    try {
      await api.post(`/approvals/${approvalId}/delegate`, { delegateToUserId: delegateTo });
      onDecision();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Delegation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <button onClick={() => decide("APPROVED")} disabled={loading} style={styles.approve}>
          Approve
        </button>
        <button onClick={() => decide("REJECTED")} disabled={loading} style={styles.reject}>
          Reject
        </button>
        <button onClick={() => setShowDelegate(!showDelegate)} disabled={loading} style={styles.delegate}>
          {showDelegate ? "Cancel" : "Delegate"}
        </button>
      </div>

      {showDelegate && (
        <div style={styles.delegatePanel}>
          <select
            value={delegateTo}
            onChange={(e) => setDelegateTo(e.target.value)}
            style={styles.select}
          >
            <option value="">Select a member to delegate to</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.email} ({m.role})
              </option>
            ))}
          </select>
          <button onClick={delegate} disabled={loading || !delegateTo} style={styles.confirmBtn}>
            Confirm
          </button>
        </div>
      )}
    </div>
  );
};

export default ApprovalActions;

const styles: Record<string, React.CSSProperties> = {
  actions: { display: "flex", gap: "8px" },
  approve: {
    padding: "9px 20px",
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
  },
  reject: {
    padding: "9px 20px",
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 600,
    fontSize: "14px",
    cursor: "pointer",
  },
  delegate: {
    padding: "9px 20px",
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
  },
  delegatePanel: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
    alignItems: "center",
  },
  select: {
    flex: 1,
    padding: "9px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    minWidth: "260px",
  },
  confirmBtn: {
    padding: "9px 18px",
    background: "#6366f1",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
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
