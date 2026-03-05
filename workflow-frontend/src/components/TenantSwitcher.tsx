import { useTenant } from "../context/TenantContext";

const TenantSwitcher = () => {
  const { tenants, activeTenant, selectTenant, loading } = useTenant();

  if (loading) return <div>Loading tenants...</div>;

  if (tenants.length === 0) return <div>No tenants available</div>;

  return (
    <select
      value={activeTenant?.id ?? ""}
      onChange={(e) => {
        const selected = tenants.find((t) => t.id === e.target.value);
        if (selected) selectTenant(selected);
      }}
    >
      <option value="" disabled>
        Select Tenant
      </option>
      {tenants.map((tenant) => (
        <option key={tenant.id} value={tenant.id}>
          {tenant.name} ({tenant.role})
        </option>
      ))}
    </select>
  );
};

export default TenantSwitcher;
