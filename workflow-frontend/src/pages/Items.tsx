import { useEffect, useState } from "react";
import api from "../api/api";
import { useTenant } from "../context/TenantContext";
import ItemForm from "../components/Items/ItemForm";
import ItemList from "../components/Items/ItemList";
import TransitionActions from "../components/Items/TransitionActions";
import type { Item } from "../components/Items/Types";

const Items = () => {
  const { activeTenant } = useTenant();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const fetchItems = async () => {
    const res = await api.get("/items");
    setItems(res.data.data ?? res.data);
  };

  useEffect(() => { setSelectedItem(null); fetchItems(); }, [activeTenant?.id]);

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2>Items</h2>
        <p style={styles.sub}>Create and manage workflow items.</p>
      </div>

      <ItemForm onCreate={fetchItems} />
      <ItemList items={items} onSelect={(item) => setSelectedItem(item)} />

      {selectedItem && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelTitle}>{selectedItem.title}</div>
              <div style={styles.panelMeta}>
                {selectedItem.workflow_name} &mdash; currently in <strong>{selectedItem.current_state}</strong>
              </div>
            </div>
            <button style={styles.closeBtn} onClick={() => setSelectedItem(null)}>x</button>
          </div>
          <TransitionActions
            itemId={selectedItem.id}
            itemVersion={selectedItem.version}
            onTransition={() => { fetchItems(); setSelectedItem(null); }}
          />
        </div>
      )}
    </div>
  );
};

export default Items;

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
