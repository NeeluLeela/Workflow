
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import api from "../api/api";
import { useAuth } from "./AuthContext";

type Tenant = {
  id: string;
  name: string;
  role: string;
};

type TenantContextType = {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  selectTenant: (tenant: Tenant) => void;
  clearTenant: () => void;
  loading: boolean;
};

const TenantContext = createContext<TenantContextType | null>(null);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchTenants = async () => {
      setLoading(true);
      try {
        const res = await api.get("/tenants");
        setTenants(res.data);

        const storedTenantId = localStorage.getItem("tenantId");
        if (storedTenantId) {
          const found = res.data.find(
            (t: Tenant) => t.id === storedTenantId
          );
          if (found) setActiveTenant(found);
        }
      } catch {
        console.error("Failed to load tenants");
      } finally {
        setLoading(false);
      }
    };

    fetchTenants();
  }, [user]);

  const selectTenant = (tenant: Tenant) => {
    setActiveTenant(tenant);
    localStorage.setItem("tenantId", tenant.id);
  };

  const clearTenant = () => {
    setActiveTenant(null);
    localStorage.removeItem("tenantId");
  };

  return (
    <TenantContext.Provider value={{ tenants, activeTenant, selectTenant, clearTenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used inside TenantProvider");
  }
  return context;
};
