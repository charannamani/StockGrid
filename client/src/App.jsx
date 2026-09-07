import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider, useAuth } from "./context/AuthContext";

const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Warehouses = lazy(() => import("./pages/Warehouses"));
const Products = lazy(() => import("./pages/Products"));
const StockView = lazy(() => import("./pages/StockView"));
const MovementHistory = lazy(() => import("./pages/MovementHistory"));
const Transfers = lazy(() => import("./pages/Transfers"));
const Reservations = lazy(() => import("./pages/Reservations"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));

import Layout from "./components/Layout";

const PageFallback = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      padding: "32px 0",
      minHeight: "40vh",
    }}
  >
    <div className="skeleton" style={{ width: "260px", height: "28px" }} />
    <div className="skeleton" style={{ width: "180px", height: "16px" }} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "16px" }}>
      <div className="skeleton" style={{ height: "120px", borderRadius: "12px" }} />
      <div className="skeleton" style={{ height: "120px", borderRadius: "12px" }} />
      <div className="skeleton" style={{ height: "120px", borderRadius: "12px" }} />
    </div>
  </div>
);

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          <Route path="/stock" element={<StockView />} />
          <Route path="/movements" element={<MovementHistory />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/warehouses" element={<Warehouses />} />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/api-keys"
            element={
              <AdminRoute>
                <ApiKeys />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;