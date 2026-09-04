import { useEffect, useState } from "react";
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Warehouse,
  Search,
} from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const StockView = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [stock, setStock] = useState([]);
  const [warehouseMeta, setWarehouseMeta] = useState({ totalOccupancy: 0, capacity: null, spaceLeft: null, isOverCapacity: false });
  const [search, setSearch] = useState("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const res = await API.get("/warehouses");
        const list = res.data || [];
        setWarehouses(list);
        if (list.length > 0) setSelectedWarehouse(list[0]._id);
      } catch (err) {
        toast.error("Couldn't load warehouses");
      } finally {
        setLoadingWarehouses(false);
      }
    };
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (!selectedWarehouse) return;

    const fetchStock = async () => {
      setLoadingStock(true);
      try {
        const res = await API.get(`/stock/warehouse/${selectedWarehouse}`);
        setStock(res.data.stock || []);
        setWarehouseMeta({
          totalOccupancy: res.data.totalOccupancy || 0,
          capacity: res.data.capacity,
          spaceLeft: res.data.spaceLeft,
          isOverCapacity: res.data.isOverCapacity,
        });
      } catch (err) {
        toast.error("Couldn't load stock for this warehouse");
      } finally {
        setLoadingStock(false);
      }
    };
    fetchStock();
  }, [selectedWarehouse]);

  const activeWarehouseObj = warehouses.find((w) => w._id === selectedWarehouse);

  const filteredStock = stock.filter(
    (entry) =>
      entry.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      entry.product?.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = stock.filter(
    (entry) => entry.currentQuantity <= entry.lowStockThreshold
  ).length;

  if (loadingWarehouses) {
    return <div style={styles.loadingState}>Loading physical warehouse list...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Location Stock View</h1>
          <p style={styles.subtitle}>
            Real-time physical inventory count and facility capacity tracking.
          </p>
        </div>

        <div style={styles.warehouseSelectorGroup}>
          <Warehouse size={16} color="#ea580c" />
          <select
            style={styles.select}
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name} — {w.address || "Main Facility"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Active Facility & Area</span>
          <span style={styles.summaryValue}>{activeWarehouseObj?.name || "—"}</span>
          <span style={styles.summarySub}>{activeWarehouseObj?.address || "No area recorded"}</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>On-Hand Units / Capacity</span>
          <span style={styles.summaryValue}>
            {warehouseMeta.totalOccupancy.toLocaleString()}
            {warehouseMeta.capacity != null ? ` / ${warehouseMeta.capacity.toLocaleString()}` : " (No Cap)"}
          </span>
          <span
            style={{
              ...styles.summarySub,
              color: warehouseMeta.isOverCapacity ? "#dc2626" : "#16a34a",
              fontWeight: 600,
            }}
          >
            {warehouseMeta.capacity == null
              ? "Unlimited Capacity"
              : warehouseMeta.isOverCapacity
              ? `Over capacity by ${Math.abs(warehouseMeta.spaceLeft)} units`
              : `${warehouseMeta.spaceLeft} units space available`}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Reorder Alerts</span>
          <span
            style={{
              ...styles.summaryValue,
              color: lowStockCount > 0 ? "#dc2626" : "#16a34a",
            }}
          >
            {lowStockCount} items low
          </span>
        </div>
      </div>

      <div style={styles.controlBar}>
        <div style={styles.searchWrapper}>
          <Search size={16} color="#94a3b8" />
          <input
            style={styles.searchInput}
            placeholder="Search stock by SKU or Product Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={styles.tableCard}>
        {loadingStock ? (
          <div style={styles.emptyState}>Syncing live inventory data...</div>
        ) : filteredStock.length === 0 ? (
          <div style={styles.emptyState}>
            <Boxes size={32} color="#94a3b8" />
            <p style={styles.emptyText}>No stock records registered at this location.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <div style={styles.tableHeaderRow}>
              <span>PRODUCT / SKU</span>
              <span>CATEGORY</span>
              <span style={{ textAlign: "right" }}>ON-HAND QTY</span>
              <span>THRESHOLD</span>
              <span style={{ textAlign: "right" }}>AVAILABILITY STATUS</span>
            </div>

            {filteredStock.map((entry) => {
              const isLow = entry.currentQuantity <= entry.lowStockThreshold;
              const thresholdRatio = Math.min(
                100,
                Math.round((entry.currentQuantity / (entry.lowStockThreshold * 2 || 20)) * 100)
              );

              return (
                <div key={entry._id} style={styles.tableRow}>
                  <div style={styles.productCell}>
                    <span style={styles.productName}>{entry.product?.name || "—"}</span>
                    <span style={styles.productSku}>{entry.product?.sku || "SKU-UNKNOWN"}</span>
                  </div>

                  <div style={styles.categoryCell}>
                    {entry.product?.category || "—"}
                  </div>

                  <div style={styles.qtyCell}>{entry.currentQuantity}</div>

                  <div style={styles.thresholdCell}>
                    <div style={styles.thresholdMeta}>
                      <span>{entry.currentQuantity} / {entry.lowStockThreshold} Min</span>
                    </div>
                    <div style={styles.progressTrack}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${thresholdRatio}%`,
                          background: isLow ? "#dc2626" : "#16a34a",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    {isLow ? (
                      <span style={styles.badgeLow}>
                        <AlertTriangle size={12} style={{ marginRight: "4px" }} />
                        Low Stock Alert
                      </span>
                    ) : (
                      <span style={styles.badgeOk}>
                        <CheckCircle2 size={12} style={{ marginRight: "4px" }} />
                        Optimal
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: { fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "4px" },
  warehouseSelectorGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#fff",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "8px 14px",
  },
  select: {
    border: "none",
    outline: "none",
    fontSize: "13px",
    fontWeight: 600,
    color: "#0f172a",
    background: "transparent",
    minWidth: "220px",
  },
  summaryBar: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "16px 24px",
    marginBottom: "20px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  summaryItem: { display: "flex", flexDirection: "column", gap: "2px" },
  summaryLabel: { fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" },
  summaryValue: { fontSize: "18px", fontWeight: 800, color: "#0f172a" },
  summarySub: { fontSize: "11px", color: "#64748b" },
  divider: { width: "1px", height: "32px", background: "#e2e8f0" },
  controlBar: { marginBottom: "16px" },
  searchWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#fff",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "9px 14px",
    width: "320px",
  },
  searchInput: { border: "none", outline: "none", fontSize: "13px", width: "100%" },
  tableCard: {
    background: "#fff",
    borderRadius: "14px",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  tableWrapper: { display: "flex", flexDirection: "column" },
  tableHeaderRow: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.2fr 1fr 1.8fr 1.5fr",
    padding: "12px 20px",
    background: "#f8fafc",
    fontSize: "11px",
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: "0.05em",
    borderBottom: "1px solid #e2e8f0",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.2fr 1fr 1.8fr 1.5fr",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
  },
  productCell: { display: "flex", flexDirection: "column" },
  productName: { fontWeight: 600, color: "#0f172a" },
  productSku: { fontSize: "11px", fontFamily: "monospace", color: "#64748b", marginTop: "2px" },
  categoryCell: { color: "#475569" },
  qtyCell: { fontWeight: 800, fontSize: "15px", color: "#0f172a", textAlign: "right" },
  thresholdCell: { paddingRight: "16px" },
  thresholdMeta: { fontSize: "11px", color: "#64748b", marginBottom: "4px" },
  progressTrack: { width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: "999px", transition: "width 0.3s ease" },
  badgeOk: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "6px",
    background: "#f0fdf4",
    color: "#16a34a",
    border: "1px solid #bbf7d0",
    display: "inline-flex",
    alignItems: "center",
  },
  badgeLow: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "6px",
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    display: "inline-flex",
    alignItems: "center",
  },
  emptyState: { padding: "48px", textAlign: "center", color: "#94a3b8" },
  emptyText: { marginTop: "10px", fontSize: "14px" },
  loadingState: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
};

export default StockView;