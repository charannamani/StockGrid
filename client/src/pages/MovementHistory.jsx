import { useEffect, useState } from "react";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const TYPE_STYLES = {
  inbound: { label: "Inbound", bg: "#dcfce7", color: "#16a34a" },
  outbound: { label: "Outbound", bg: "#fee2e2", color: "#dc2626" },
  transfer_in: { label: "Transfer In", bg: "#dbeafe", color: "#2563eb" },
  transfer_out: { label: "Transfer Out", bg: "#ffedd5", color: "#ea580c" },
  adjustment: { label: "Adjustment", bg: "#f1f5f9", color: "#64748b" },
};

const emptyMovementForm = { product: "", warehouse: "", type: "inbound", quantity: "", direction: "increase", reason: "" };
const emptyTransferForm = { product: "", fromWarehouse: "", toWarehouse: "", quantity: "", reason: "" };

const MovementHistory = () => {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({ product: "", warehouse: "" });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState("movement"); // "movement" | "transfer"
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [transferForm, setTransferForm] = useState(emptyTransferForm);
  const [saving, setSaving] = useState(false);

  const fetchMovements = async (activeFilters = filters) => {
    try {
      const params = {};
      if (activeFilters.product) params.product = activeFilters.product;
      if (activeFilters.warehouse) params.warehouse = activeFilters.warehouse;

           const res = await API.get("/movements", { params });
      setMovements(res.data.movements || []);    } catch (err) {
      toast.error("Couldn't load movement history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [productsRes, warehousesRes] = await Promise.all([
          API.get("/products"),
          API.get("/warehouses"),
        ]);
        setProducts(productsRes.data || []);
        setWarehouses(warehousesRes.data || []);
      } catch (err) {
        toast.error("Couldn't load products/warehouses");
      }
    };
    fetchRefs();
    fetchMovements();
  }, []);

  const applyFilters = (next) => {
    setFilters(next);
    fetchMovements(next);
  };

  const openForm = () => {
    setFormMode("movement");
    setMovementForm(emptyMovementForm);
    setTransferForm(emptyTransferForm);
    setShowForm(true);
  };

  const closeForm = () => setShowForm(false);

  const handleMovementSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        productId: movementForm.product,     // Aligned with backend req.body
        warehouseId: movementForm.warehouse, // Aligned with backend req.body
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        reason: movementForm.reason,
        ...(movementForm.type === "adjustment" ? { direction: movementForm.direction } : {}),
      };
      await API.post("/movements", payload);
      toast.success("Movement recorded");
      closeForm();
      fetchMovements();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (transferForm.fromWarehouse === transferForm.toWarehouse) {
      toast.error("Source and destination warehouses must be different");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        productId: transferForm.product,              // Aligned with backend req.body
        fromWarehouseId: transferForm.fromWarehouse, // Aligned with backend req.body
        toWarehouseId: transferForm.toWarehouse,     // Aligned with backend req.body
        quantity: Number(transferForm.quantity),
        reason: transferForm.reason,
      };
      await API.post("/movements/transfer", payload);
      toast.success("Transfer recorded");
      closeForm();
      fetchMovements();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={styles.loadingText}>Loading movement history...</div>;

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Movement History</h1>
          <p style={styles.subtitle}>{movements.length} record{movements.length !== 1 ? "s" : ""}</p>
        </div>
        <button style={styles.primaryBtn} onClick={openForm}>
          <Plus size={16} />
          <span>New Movement</span>
        </button>
      </div>

      <div style={styles.filterRow}>
        <select
          style={styles.select}
          value={filters.product}
          onChange={(e) => applyFilters({ ...filters, product: e.target.value })}
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        <select
          style={styles.select}
          value={filters.warehouse}
          onChange={(e) => applyFilters({ ...filters, warehouse: e.target.value })}
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w._id} value={w._id}>{w.name}</option>
          ))}
        </select>
      </div>

      <div style={styles.section}>
        {movements.length === 0 ? (
          <p style={styles.emptyText}>No movements match these filters.</p>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHeaderRow}>
              <span>Product</span>
              <span>Type</span>
              <span>Qty</span>
              <span>Warehouse</span>
              <span>By</span>
              <span>Date</span>
            </div>
            {movements.map((m) => {
              const t = TYPE_STYLES[m.type] || TYPE_STYLES.adjustment;
              return (
                <div key={m._id} style={styles.tableRow}>
                  <span style={styles.tableCellBold}>{m.product?.name || "—"}</span>
                  <span style={{ ...styles.badge, background: t.bg, color: t.color }}>{t.label}</span>
                  <span style={styles.tableCell}>{m.quantity}</span>
                  <span style={styles.tableCell}>{m.warehouse?.name || "—"}</span>
                  <span style={styles.tableCell}>{m.performedBy?.name || "—"}</span>
                  <span style={styles.tableCell}>
                    {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div style={styles.overlay} onClick={closeForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>New Movement</h2>
              <button style={styles.closeBtn} onClick={closeForm}>
                <X size={18} />
              </button>
            </div>

            <div style={styles.tabRow}>
              <button
                type="button"
                style={{ ...styles.tabBtn, ...(formMode === "movement" ? styles.tabBtnActive : {}) }}
                onClick={() => setFormMode("movement")}
              >
                Inbound / Outbound / Adjust
              </button>
              <button
                type="button"
                style={{ ...styles.tabBtn, ...(formMode === "transfer" ? styles.tabBtnActive : {}) }}
                onClick={() => setFormMode("transfer")}
              >
                Transfer
              </button>
            </div>

            {formMode === "movement" ? (
              <form onSubmit={handleMovementSubmit}>
                <label style={styles.label}>Product</label>
                <select
                  style={styles.input}
                  value={movementForm.product}
                  onChange={(e) => setMovementForm({ ...movementForm, product: e.target.value })}
                  required
                >
                  <option value="">Select product</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>

                <label style={styles.label}>Warehouse</label>
                <select
                  style={styles.input}
                  value={movementForm.warehouse}
                  onChange={(e) => setMovementForm({ ...movementForm, warehouse: e.target.value })}
                  required
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>

                <label style={styles.label}>Type</label>
                <select
                  style={styles.input}
                  value={movementForm.type}
                  onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}
                >
                  <option value="inbound">Inbound</option>
                  <option value="outbound">Outbound</option>
                  <option value="adjustment">Adjustment</option>
                </select>

                {movementForm.type === "adjustment" && (
                  <>
                    <label style={styles.label}>Direction</label>
                    <select
                      style={styles.input}
                      value={movementForm.direction}
                      onChange={(e) => setMovementForm({ ...movementForm, direction: e.target.value })}
                    >
                      <option value="increase">Increase</option>
                      <option value="decrease">Decrease</option>
                    </select>
                  </>
                )}

                <label style={styles.label}>Quantity</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                  required
                />

                <label style={styles.label}>Reason (optional)</label>
                <input
                  style={styles.input}
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                />

                <button style={styles.submitBtn} type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Record Movement"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleTransferSubmit}>
                <label style={styles.label}>Product</label>
                <select
                  style={styles.input}
                  value={transferForm.product}
                  onChange={(e) => setTransferForm({ ...transferForm, product: e.target.value })}
                  required
                >
                  <option value="">Select product</option>
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>

                <label style={styles.label}>From Warehouse</label>
                <select
                  style={styles.input}
                  value={transferForm.fromWarehouse}
                  onChange={(e) => setTransferForm({ ...transferForm, fromWarehouse: e.target.value })}
                  required
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>

                <label style={styles.label}>To Warehouse</label>
                <select
                  style={styles.input}
                  value={transferForm.toWarehouse}
                  onChange={(e) => setTransferForm({ ...transferForm, toWarehouse: e.target.value })}
                  required
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
                </select>

                <label style={styles.label}>Quantity</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  required
                />

                <label style={styles.label}>Reason (optional)</label>
                <input
                  style={styles.input}
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                />

                <button style={styles.submitBtn} type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Record Transfer"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "4px" },
  primaryBtn: {
    display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px",
    border: "none", background: "linear-gradient(135deg, #ef4444, #f59e0b)", color: "#fff",
    fontSize: "13px", fontWeight: 600, cursor: "pointer",
  },
  filterRow: { display: "flex", gap: "10px", marginBottom: "16px" },
  select: { padding: "9px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px", background: "#fff" },
  section: { background: "#fff", borderRadius: "12px", padding: "8px 20px", border: "1px solid #e5e7eb" },
  emptyText: { fontSize: "13px", color: "#94a3b8", padding: "20px 0" },
  table: { display: "flex", flexDirection: "column" },
  tableHeaderRow: {
    display: "grid", gridTemplateColumns: "1.6fr 1fr 0.6fr 1.2fr 1fr 1fr", padding: "12px 0",
    fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
    letterSpacing: "0.03em", borderBottom: "1px solid #f1f5f9",
  },
  tableRow: {
    display: "grid", gridTemplateColumns: "1.6fr 1fr 0.6fr 1.2fr 1fr 1fr", alignItems: "center",
    padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px",
  },
  tableCellBold: { fontWeight: 600, color: "#111827" },
  tableCell: { color: "#64748b" },
  badge: { fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", width: "fit-content" },
  loadingText: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px",
  },
  modal: { background: "#fff", borderRadius: "14px", padding: "24px", width: "400px", maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "#111827", margin: 0 },
  closeBtn: { border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" },
  tabRow: { display: "flex", gap: "6px", marginBottom: "16px", background: "#f1f5f9", padding: "4px", borderRadius: "8px" },
  tabBtn: {
    flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: "transparent",
    color: "#64748b", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  },
  tabBtnActive: { background: "#fff", color: "#111827", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" },
  label: { display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px", marginTop: "12px" },
  input: { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "14px", boxSizing: "border-box", fontFamily: "inherit" },
  submitBtn: {
    width: "100%", marginTop: "20px", padding: "11px", borderRadius: "8px", border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)", color: "#fff", fontSize: "14px",
    fontWeight: 600, cursor: "pointer",
  },
};

export default MovementHistory;