import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Warehouses from "./pages/Warehouses";
import Products from "./pages/Products";
import StockView from "./pages/StockView";
import MovementHistory from "./pages/MovementHistory";
import Availability from "./pages/Availability";

import Layout from "./components/Layout";

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();

  return user ? children : <Navigate to="/login" replace />;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};



const AppRoutes = () => {
  return (
    <Routes>

      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />


      {/* Protected Routes */}
      <Route
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >

        {}
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/products" element={<Products />} />

        <Route path="/stock" element={<StockView />} />

        <Route
          path="/movements"
          element={<MovementHistory />}
        />

        <Route
          path="/availability"
          element={<Availability />}
        />


        {}
        <Route
          path="/warehouses"
          element={
            <AdminRoute>
              <Warehouses />
            </AdminRoute>
          }
        />

      </Route>


      {}
      <Route
        path="/"
        element={<Navigate to="/dashboard" replace />}
      />


      {/* Unknown Route */}
      <Route
        path="*"
        element={<Navigate to="/dashboard" replace />}
      />

    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>

      <BrowserRouter>

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
          }}
        />

        <AppRoutes />

      </BrowserRouter>

    </AuthProvider>
  );
}

export default App;