import { Outlet, Navigate } from "react-router-dom";
import { useTenant } from "../context/TenantContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/SideBar";

const AppLayout = () => {
  const { activeTenant } = useTenant();

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <div style={styles.body}>
        <Sidebar />
        <main style={styles.main}>
          {!activeTenant ? <Navigate to="/select-tenant" replace /> : <Outlet />}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

const styles: Record<string, React.CSSProperties> = {
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  main: {
    flex: 1,
    padding: "28px 32px",
    overflowY: "auto",
    background: "#f9fafb",
  },
};
