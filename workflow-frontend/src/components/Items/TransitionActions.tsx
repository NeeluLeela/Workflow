import { useEffect, useState } from "react";
import api from "../../api/api";

type Transition = {
  id: string;
  to_state: string;
  requires_approval: boolean;
  approval_strategy: string;
};

type Props = { itemId: string; itemVersion: number; onTransition: () => void };

const TransitionActions = ({ itemId, itemVersion, onTransition }: Props) => {
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/items/${itemId}/transitions`).then((res) => setTransitions(res.data));
  }, [itemId]);

  const trigger = async (transitionId: string) => {
    setLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      await api.post(`/items/${itemId}/transition`, { transitionId, version: itemVersion, idempotencyKey });
      onTransition();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Transition failed");
    } finally {
      setLoading(false);
    }
  };

  if (transitions.length === 0) {
    return <p style={{ color: "#9ca3af", fontSize: "13px" }}>No transitions available from this state.</p>;
  }

  return (
    <div>
      {error && <p style={styles.error}>{error}</p>}
      <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "10px" }}>Move to:</p>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {transitions.map((t) => (
          <button
            key={t.id}
            onClick={() => trigger(t.id)}
            disabled={loading}
            style={t.requires_approval ? styles.approvalBtn : styles.directBtn}
          >
            {t.to_state}
            {t.requires_approval && <span style={styles.tag}>approval</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TransitionActions;

const styles: Record<string, React.CSSProperties> = {
  directBtn: {
    padding: "8px 16px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  approvalBtn: {
    padding: "8px 16px",
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  tag: {
    fontSize: "11px",
    background: "#fef3c7",
    color: "#92400e",
    padding: "1px 6px",
    borderRadius: "4px",
    fontWeight: 600,
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
