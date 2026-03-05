import { useEffect, useState } from "react";
import api from "../../api/api";

type Workflow = { id: string; name: string; is_active: boolean };
type Props = { onCreate: () => void };

const ItemForm = ({ onCreate }: Props) => {
  const [title, setTitle] = useState("");
  const [workflowId, setWorkflowId] = useState("");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get("/workflows").then((res) => {
      const all: Workflow[] = res.data.data ?? res.data;
      setWorkflows(all.filter((w) => w.is_active));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowId || !title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await api.post("/items", { workflowId, title });
      setTitle("");
      setWorkflowId("");
      onCreate();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>New Item</h3>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          type="text"
          placeholder="Item title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={styles.input}
          required
        />
        <select
          value={workflowId}
          onChange={(e) => setWorkflowId(e.target.value)}
          style={styles.select}
        >
          <option value="">Select workflow</option>
          {workflows.map((wf) => (
            <option key={wf.id} value={wf.id}>{wf.name}</option>
          ))}
        </select>
        <button type="submit" disabled={loading || !workflowId || !title.trim()} style={styles.btn}>
          {loading ? "Creating..." : "Create Item"}
        </button>
      </form>
      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
};

export default ItemForm;

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "20px",
    marginBottom: "24px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: 600,
    marginBottom: "14px",
    color: "#111827",
  },
  form: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minWidth: "200px",
    padding: "9px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
  },
  select: {
    padding: "9px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    minWidth: "180px",
  },
  btn: {
    padding: "9px 18px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  error: {
    marginTop: "10px",
    fontSize: "13px",
    color: "#dc2626",
  },
};
