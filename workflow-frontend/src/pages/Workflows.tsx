import { useEffect, useState } from "react";
import api from "../api/api";
import { useTenant } from "../context/TenantContext";
import WorkflowForm from "../components/Workflows/WorkflowForm";
import type { WorkflowPayload } from "../components/Workflows/WorkflowForm";
import WorkflowList from "../components/Workflows/WorkflowList";

type Workflow = { id: string; name: string; version: number; is_active: boolean; created_at: string };

const Workflows = () => {
  const { activeTenant } = useTenant();
  const isAdmin = activeTenant?.role === "ADMIN";
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await api.get("/workflows");
      setWorkflows(res.data.data ?? res.data);
    } catch {
      setError("Failed to load workflows");
    } finally {
      setLoading(false);
    }
  };

  const createWorkflow = async (data: WorkflowPayload) => {
    await api.post("/workflows", data);
    await fetchWorkflows();
  };

  useEffect(() => { fetchWorkflows(); }, [activeTenant?.id]);

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2>Workflows</h2>
        <p style={styles.sub}>Define the states and transitions for your approval processes.</p>
      </div>

      {isAdmin && <WorkflowForm onCreate={createWorkflow} />}

      {loading && <p style={{ color: "#9ca3af" }}>Loading...</p>}
      {error && <p style={{ color: "#dc2626", fontSize: "13px" }}>{error}</p>}

      {workflows.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Existing Workflows</h3>
          <WorkflowList workflows={workflows} onUpdate={fetchWorkflows} />
        </div>
      )}
    </div>
  );
};

export default Workflows;

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { marginBottom: "24px" },
  sub: { color: "#6b7280", fontSize: "14px" },
  section: { marginTop: "8px" },
  sectionTitle: { fontSize: "15px", marginBottom: "12px", color: "#374151" },
};
