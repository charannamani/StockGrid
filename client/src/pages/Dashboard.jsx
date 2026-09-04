import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Package,
  Warehouse,
  Boxes,
  Activity,
  Layers,
  AlertTriangle,
  Plus,
  Search,
  ArrowUpRight,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const TYPE_STYLES = {
  inbound: { label: "Inbound", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  outbound: { label: "Outbound", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  transfer_in: { label: "Transfer In", bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  transfer_out: { label: "Transfer Out", bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  adjustment: { label: "Adjustment", bg: "#f8fafc", color: "#475569", border: "#e2e8f0" },
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    productCount: 0,
    warehouseCount: 0,
    totalStock: 0,
    lowStockCount: 0,
    movements: [],
    warehouseDistribution: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [productsRes, warehousesRes, movementsRes] = await Promise.all([
          API.get("/products"),
          API.get("/warehouses"),
          API.get("/movements"),
        ]);

        const warehouses = warehousesRes.data || [];
        let totalStock = 0;
        let lowStockCount = 0;
        const distribution = [];

        const stockPerWarehouse = await Promise.all(
          warehouses.map((w) => API.get(`/stock/warehouse/${w._id}`))
        );

        stockPerWarehouse.forEach((res, idx) => {
          const rawData = res.data;
          const warehouseStock = Array.isArray(rawData) ? rawData : (rawData?.stock || []);

          const qtySum = warehouseStock.reduce((s, entry) => {
            const qty = entry.currentQuantity || 0;
            const threshold = entry.lowStockThreshold || 10;
            if (qty <= threshold) lowStockCount++;
            return s + qty;
          }, 0);

          totalStock += qtySum;
          distribution.push({
            name: warehouses[idx]?.name || `Warehouse ${idx + 1}`,
            stock: qtySum,
          });
        });

        setStats({
          productCount: productsRes.data?.length || 0,
          warehouseCount: warehouses.length,
          totalStock,
          lowStockCount,
          movements: (movementsRes.data.movements || []).slice(0, 6),
          warehouseDistribution: distribution,
        });
      } catch (err) {
        toast.error("Couldn't load real-time dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.headerSkeleton} />
        <div style={styles.cardGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={styles.cardSkeleton} />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: "Total Units Stored",
      value: stats.totalStock.toLocaleString(),
      subtext: "Across all operational locations",
      icon: Boxes,
      alert: false,
    },
    {
      label: "Active Warehouses",
      value: stats.warehouseCount,
      subtext: "Configured storage facilities",
      icon: Warehouse,
      alert: false,
    },
    {
      label: "Catalog SKUs",
      value: stats.productCount,
      subtext: "Registered products in network",
      icon: Package,
      alert: false,
    },
    {
      label: "Low Stock Alerts",
      value: stats.lowStockCount,
      subtext: "Below safe reorder minimum",
      icon: AlertTriangle,
      alert: stats.lowStockCount > 0,
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <div style={styles.welcomeRow}>
            <h1 style={styles.title}>System Overview</h1>
            <span style={styles.liveBadge}>
              <span style={styles.liveDot} /> Live Sync
            </span>
          </div>
          <p style={styles.subtitle}>
            Welcome back, <strong style={{ color: "#0f172a" }}>{user?.name || "Operator"}</strong>. Operational multi-warehouse summary.
          </p>
        </div>

        <div style={styles.actionGroup}>
          <button style={styles.secondaryBtn} onClick={() => navigate("/availability")}>
            <Search size={16} />
            <span>Check Availability</span>
          </button>
          <button style={styles.primaryBtn} onClick={() => navigate("/movements")}>
            <Plus size={16} />
            <span>Log Movement</span>
          </button>
        </div>
      </div>

      <div style={styles.cardGrid}>
        {cards.map(({ label, value, subtext, icon: Icon, alert }) => (
          <div
            key={label}
            style={{
              ...styles.card,
              ...(alert ? styles.cardAlert : {}),
            }}
          >
            <div style={styles.cardTop}>
              <div style={{ ...styles.cardIcon, ...(alert ? styles.cardIconAlert : {}) }}>
                <Icon size={20} color="#fff" />
              </div>
              {alert && <span style={styles.alertBadge}>Action Needed</span>}
            </div>
            <div>
              <div style={styles.cardValue}>{value}</div>
              <div style={styles.cardLabel}>{label}</div>
              <div style={styles.cardSubtext}>{subtext}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.mainGrid}>
        <div style={styles.feedSection}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitleGroup}>
              <Activity size={18} color="#ea580c" />
              <h2 style={styles.sectionTitle}>Recent Stock Movements</h2>
            </div>
            <Link to="/movements" style={styles.viewAllLink}>
              View All Audit Logs <ArrowUpRight size={14} />
            </Link>
          </div>

          {stats.movements.length === 0 ? (
            <div style={styles.emptyState}>
              <Layers size={32} color="#94a3b8" />
              <p style={styles.emptyText}>No inventory movements recorded yet.</p>
            </div>
          ) : (
            <div style={styles.tableWrapper}>
              <div style={styles.tableHeaderRow}>
                <span>PRODUCT / SKU</span>
                <span>TYPE</span>
                <span style={{ textAlign: "right" }}>QTY</span>
                <span>FACILITY</span>
                <span style={{ textAlign: "right" }}>DATE</span>
              </div>
              {stats.movements.map((m) => {
                const typeStyle = TYPE_STYLES[m.type] || TYPE_STYLES.adjustment;
                return (
                  <div key={m._id} style={styles.tableRow}>
                    <div style={styles.productCell}>
                      <span style={styles.productName}>{m.product?.name || "—"}</span>
                      <span style={styles.productSku}>{m.product?.sku || "SKU-UNKNOWN"}</span>
                    </div>

                    <div>
                      <span
                        style={{
                          ...styles.badge,
                          background: typeStyle.bg,
                          color: typeStyle.color,
                          borderColor: typeStyle.border,
                        }}
                      >
                        {typeStyle.label}
                      </span>
                    </div>

                    <div style={styles.qtyCell}>
                      {m.type === "outbound" || m.type === "transfer_out" ? "-" : "+"}
                      {m.quantity}
                    </div>

                    <div style={styles.locationCell}>
                      {m.warehouse?.name || "—"}
                    </div>

                    <div style={styles.dateCell}>
                      {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={styles.sideSection}>
          <div style={styles.sectionHeader}>
            <div style={styles.sectionTitleGroup}>
              <Warehouse size={18} color="#ea580c" />
              <h2 style={styles.sectionTitle}>Warehouse Allocation</h2>
            </div>
            <Link to="/warehouses" style={styles.viewAllLink}>
              Manage
            </Link>
          </div>

          <div style={styles.distributionList}>
            {stats.warehouseDistribution.length === 0 ? (
              <p style={styles.emptyText}>No warehouse locations active.</p>
            ) : (
              stats.warehouseDistribution.map((wh) => {
                const percentage =
                  stats.totalStock > 0
                    ? Math.round((wh.stock / stats.totalStock) * 100)
                    : 0;

                return (
                  <div key={wh.name} style={styles.distItem}>
                    <div style={styles.distMeta}>
                      <span style={styles.distName}>{wh.name}</span>
                      <span style={styles.distValue}>
                        {wh.stock.toLocaleString()} units ({percentage}%)
                      </span>
                    </div>
                    <div style={styles.progressBarTrack}>
                      <div
                        style={{
                          ...styles.progressBarFill,
                          width: `${Math.min(percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { maxWidth: "1280px", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  welcomeRow: { display: "flex", alignItems: "center", gap: "12px" },
  title: { fontSize: "24px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "6px", margin: 0 },
  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "999px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#16a34a",
    fontSize: "12px",
    fontWeight: 600,
  },
  liveDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" },
  actionGroup: { display: "flex", alignItems: "center", gap: "10px" },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#ffffff",
    border: "none",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
  secondaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "8px",
    background: "#ffffff",
    color: "#334155",
    border: "1px solid #cbd5e1",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "18px",
    marginBottom: "32px",
  },
  card: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "20px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  cardAlert: { borderColor: "#fca5a5", background: "#fff5f5" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardIcon: {
    width: "42px",
    height: "42px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconAlert: { background: "#dc2626" },
  alertBadge: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#dc2626",
    background: "#fee2e2",
    padding: "3px 8px",
    borderRadius: "6px",
  },
  cardValue: { fontSize: "26px", fontWeight: 800, color: "#0f172a", lineHeight: "1.2" },
  cardLabel: { fontSize: "13px", fontWeight: 600, color: "#334155", marginTop: "2px" },
  cardSubtext: { fontSize: "11px", color: "#94a3b8", marginTop: "2px" },
  mainGrid: { display: "grid", gridTemplateColumns: "1fr", gap: "24px", alignItems: "start" },
  feedSection: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "24px",
    border: "1px solid #e2e8f0",
  },
  sideSection: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "24px",
    border: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" },
  sectionTitleGroup: { display: "flex", alignItems: "center", gap: "8px" },
  sectionTitle: { fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 },
  viewAllLink: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#ea580c",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  tableWrapper: { display: "flex", flexDirection: "column", width: "100%" },
  tableHeaderRow: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.2fr 1fr 1.5fr 1fr",
    padding: "10px 14px",
    background: "#f8fafc",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.05em",
    marginBottom: "6px",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.2fr 1fr 1.5fr 1fr",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
  },
  productCell: { display: "flex", flexDirection: "column" },
  productName: { fontWeight: 600, color: "#0f172a" },
  productSku: { fontSize: "11px", color: "#94a3b8" },
  badge: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid",
    display: "inline-block",
  },
  qtyCell: { fontWeight: 700, color: "#0f172a", textAlign: "right" },
  locationCell: { color: "#475569", fontWeight: 500 },
  dateCell: { color: "#94a3b8", fontSize: "12px", textAlign: "right" },
  emptyState: { padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" },
  emptyText: { fontSize: "13px", color: "#94a3b8" },
  distributionList: { display: "flex", flexDirection: "column", gap: "16px" },
  distItem: { display: "flex", flexDirection: "column", gap: "6px" },
  distMeta: { display: "flex", justifyContent: "space-between", fontSize: "13px" },
  distName: { fontWeight: 600, color: "#334155" },
  distValue: { color: "#64748b", fontSize: "12px" },
  progressBarTrack: { width: "100%", height: "8px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #ef4444, #f59e0b)",
    borderRadius: "999px",
  },
  headerSkeleton: { width: "300px", height: "40px", background: "#e2e8f0", borderRadius: "8px", marginBottom: "24px" },
  cardSkeleton: { height: "120px", background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0" },
};

export default Dashboard;