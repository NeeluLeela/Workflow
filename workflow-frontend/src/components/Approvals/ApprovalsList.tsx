type Approval = {
  id: string;
  item_id: string;
  title: string;
  workflow_name: string;
  current_state: string;
};

type Props = { approvals: Approval[]; onSelect: (a: Approval) => void };

const ApprovalList = ({ approvals, onSelect }: Props) => {
  if (approvals.length === 0) {
    return (
      <div style={styles.empty}>No pending approvals for you right now.</div>
    );
  }

  return (
    <div style={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Workflow</th>
            <th>Current State</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {approvals.map((a) => (
            <tr key={a.id}>
              <td style={{ fontWeight: 500 }}>{a.title}</td>
              <td style={{ color: "#6b7280" }}>{a.workflow_name}</td>
              <td>
                <span style={styles.badge}>{a.current_state}</span>
              </td>
              <td>
                <button onClick={() => onSelect(a)} style={styles.btn}>
                  Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ApprovalList;

const styles: Record<string, React.CSSProperties> = {
  tableWrap: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  },
  empty: {
    padding: "32px",
    textAlign: "center",
    color: "#9ca3af",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
  },
  badge: {
    display: "inline-block",
    padding: "2px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 600,
    background: "#fef3c7",
    color: "#92400e",
  },
  btn: {
    padding: "4px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "5px",
    background: "#fff",
    fontSize: "12px",
    cursor: "pointer",
    color: "#374151",
  },
};
