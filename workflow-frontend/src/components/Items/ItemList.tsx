import type { Item } from "./Types";

type Props = { items: Item[]; onSelect: (item: Item) => void };

const stateBadge = (_state: string): React.CSSProperties => ({
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 600,
  background: "#eff6ff",
  color: "#2563eb",
});

const ItemList = ({ items, onSelect }: Props) => {
  if (items.length === 0) {
    return (
      <div style={styles.empty}>No items yet. Create one above.</div>
    );
  }

  return (
    <div style={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Workflow</th>
            <th>State</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontWeight: 500 }}>{item.title}</td>
              <td style={{ color: "#6b7280" }}>{item.workflow_name}</td>
              <td><span style={stateBadge(item.current_state)}>{item.current_state}</span></td>
              <td style={{ color: "#9ca3af" }}>{new Date(item.created_at).toLocaleDateString()}</td>
              <td>
                <button onClick={() => onSelect(item)} style={styles.selectBtn}>
                  Actions
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemList;

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
  selectBtn: {
    padding: "4px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "5px",
    background: "#fff",
    color: "#374151",
    fontSize: "12px",
    cursor: "pointer",
  },
};
