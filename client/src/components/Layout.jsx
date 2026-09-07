import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Activity, ShieldCheck, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const PAGE_TITLES = {
  "/dashboard": { title: "Executive Dashboard", category: "Network Overview" },
  "/warehouses": { title: "Warehouse Directory", category: "Facility Operations" },
  "/products": { title: "Product Catalog", category: "Master Data" },
  "/stock": { title: "Inventory & Haversine Router", category: "Stock Command" },
  "/movements": { title: "Movement Ledger", category: "Audit & Tracing" },
  "/transfers": { title: "Two-Phase Transfers", category: "Custody Transit" },
  "/reservations": { title: "Stock Holds & Allocations", category: "Concurrency Engine" },
  "/users": { title: "User Permissions & RBAC", category: "Administration" },
  "/api-keys": { title: "API Credentials", category: "Developer Integration" },
};

const Layout = () => {
  const location = useLocation();
  const { user } = useAuth();
  const currentMeta = PAGE_TITLES[location.pathname] || {
    title: "StockGrid System",
    category: "Management Console",
  };

  return (
    <div style={styles.container}>
      <Sidebar />
      <div style={styles.mainWrapper}>
        {/* Modern Top Header */}
        <header style={styles.topHeader}>
          <div style={styles.headerLeft}>
            <div style={styles.categoryBreadcrumb}>{currentMeta.category}</div>
            <div style={styles.pageIndicatorTitle}>{currentMeta.title}</div>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.telemetryPill}>
              <Zap size={13} color="#ea580c" />
              <span>Two-Phase Atomic Ledger Active</span>
            </div>

            <div style={styles.statusPill}>
              <span style={styles.statusPulse} />
              <span>Redis Cluster Synced</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main style={styles.content}>
          <div style={styles.contentInner}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#f8fafc",
  },
  mainWrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
  },
  topHeader: {
    height: "56px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 32px",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  categoryBreadcrumb: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#94a3b8",
  },
  pageIndicatorTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  telemetryPill: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#ea580c",
    background: "#fff7ed",
    border: "1px solid #ffedd5",
    padding: "4px 10px",
    borderRadius: "999px",
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 500,
    color: "#047857",
    background: "#ecfdf5",
    border: "1px solid #d1fae5",
    padding: "4px 10px",
    borderRadius: "999px",
  },
  statusPulse: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#10b981",
  },
  content: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 32px 48px 32px",
  },
  contentInner: {
    maxWidth: "1400px",
    margin: "0 auto",
    width: "100%",
  },
};

export default Layout;