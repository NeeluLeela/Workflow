import { Routes, Route } from "react-router-dom";
import { protectedRoutes, publicRoutes } from "./Router/routes";
import ProtectedLayout from "./Router/ProtectedRoute";
import AppLayout from "./Layout/AppLayout";
import TenantSelect from "./pages/TenantSelectPage";

function App() {
  return (
    <Routes>
      {publicRoutes.map((route) => {
        const Component = route.element;
        return (
          <Route
            key={route.path}
            path={route.path}
            element={<Component />}
          />
        );
      })}

      <Route element={<ProtectedLayout />}>
        <Route path="/select-tenant" element={<TenantSelect />} />
        <Route element={<AppLayout />}>
          {protectedRoutes.map((route) => {
            const Component = route.element;
            return (
              <Route
                key={route.path}
                path={route.path}
                element={<Component />}
              />
            );
          })}
        </Route>
      </Route>
    </Routes>
  );
}

export default App;