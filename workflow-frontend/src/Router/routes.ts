import Dashboard from "../pages/Dashboard";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Workflows from "../pages/Workflows";
import Items from "../pages/Items";
import Approvals from "../pages/Approvals";
import AuditLog from "../pages/AuditLog";
import Members from "../pages/Members";
import SLA from "../pages/SLA";

export const publicRoutes = [
  {
    path: "/login",
    element: Login,
  },
  {
    path: "/register",
    element: Register,
  },
];

export const protectedRoutes = [
  {
    path: "/",
    element: Dashboard,
  },
  {
    path: "/workflows",
    element: Workflows,
  },
  {
    path: "/items",
    element: Items,
  },
  {
    path: "/approvals",
    element: Approvals,
  },
  {
    path: "/audit",
    element: AuditLog,
  },
  {
    path: "/members",
    element: Members,
  },
  {
    path: "/sla",
    element: SLA,
  },
];
