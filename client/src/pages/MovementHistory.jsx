import { useEffect, useState } from "react";
import { ArrowLeftRight, Plus, X, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
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
  const [formMode, setFormMode] = useState("movement");
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [transferForm, setTransferForm] = useState(emptyTransferForm);
  const [saving, setSaving] = useState(false);
  const [warehouseCapacities, setWarehouseCapacities] = useState({});

  const fetchMovements = async (activeFilters = filters) => {
    try {
      const params = {};
      if (activeFilters.product) params.product = activeFilters.product;
      if (activeFilters.warehouse) params.warehouse = activeFilters.warehouse;

      const res = await API.get("/movements", { params });
      setMovements(res.data.movements || []);
    } catch (err) {
      toast.error("Couldn't load movement history");
    } finally {
      setLoading(false);
    }
  };

  const fetchCapacityMeta = async (whList) => {
    try {
      const capacityMap = {};
      await Promise.all(
        whList.map(async (w) => {
          const res = await API.get(`/stock/warehouse/${w._id}`);
          const data = res.data;
          capacityMap[w._id] = {
            totalOccupancy: data.totalOccupancy || 0,
            capacity: data.capacity,
            spaceLeft: data.spaceLeft,
            isOverCapacity: data.isOverCapacity,
            address: w.address || "",
            stock: Array.isArray(data) ? data : (data.stock || []),
          };
        })
      );
      setWarehouseCapacities(capacityMap);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [productsRes, warehousesRes] = await Promise.all([
          API.get("/products"),
          API.get("/warehouses"),
        ]);
        const whList = warehousesRes.data || [];
        setProducts(productsRes.data || []);
        setWarehouses(whList);
        fetchCapacityMeta(whList);
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
        productId: movementForm.product,
        warehouseId: movementForm.warehouse,
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        reason: movementForm.reason,
        ...(movementForm.type === "adjustment" ? { direction: movementForm.direction } : {}),
      };
      await API.post("/movements", payload);
      toast.success("Movement recorded");
      closeForm();
      fetchMovements();
      fetchCapacityMeta(warehouses);
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
        productId: transferForm.product,
        fromWarehouseId: transferForm.fromWarehouse,
        toWarehouseId: transferForm.toWarehouse,
        quantity: Number(transferForm.quantity),
        reason: transferForm.reason,
      };
      await API.post("/movements/transfer", payload);
      toast.success("Transfer recorded");
      closeForm();
      fetchMovements();
      fetchCapacityMeta(warehouses);
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const isProductNewToWarehouse = (productId, warehouseId) => {
    if (!productId || !warehouseId) return false;
    const meta = warehouseCapacities[warehouseId];
    if (!meta || !meta.stock) return false;
    const exists = meta.stock.some((entry) => entry.product?._id === productId && entry.currentQuantity > 0);
    return !exists;
  };

  const renderCapacityBadge = (warehouseId, incomingQty = 0) => {
    const meta = warehouseCapacities[warehouseId];
    if (!meta || meta.capacity == null) {
      return (
        <div style={styles.capacityNotice}>
          <span>Capacity: Unlimited</span>
        </div>
      );
    }

    const currentSpace = meta.spaceLeft;
    const projectedSpace = currentSpace - Number(incomingQty || 0);

    if (projectedSpace < 0) {
      return (
        <div style={styles.capacityNoticeAlert}>
          <AlertTriangle size={13} color="#dc2626" />
          <span>
            Warning: Over capacity by {Math.abs(projectedSpace)} units (Current available: {currentSpace} / {meta.capacity})
          </span>
        </div>
      );
    }

    return (
      <div style={styles.capacityNoticeOk}>
        <CheckCircle2 size={13} color="#16a34a" />
        <span>Space left: {projectedSpace} / {meta.capacity} units</span>
      </div>
    );
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
            <option key={w._id} value={w._id}>{w.name} - {w.address || "Main"}</option>
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
              <span>Facility (Area)</span>
              <span>Initiator</span>
              <span>Date</span>
            </div>
            {movements.map((m) => {
              const t = TYPE_STYLES[m.type] || TYPE_STYLES.adjustment;
              return (
                <div key={m._id} style={styles.tableRow}>
                  <div>
                    <div style={styles.tableCellBold}>{m.product?.name || "—"}</div>
                    <div style={styles.tableCellSub}>{m.product?.sku || "SKU-UNKNOWN"}</div>
                  </div>
                  <div>
                    <span style={{ ...styles.badge, background: t.bg, color: t.color }}>{t.label}</span>
                  </div>
                  <span style={styles.tableCellBoldQty}>{m.quantity}</span>
                  <span style={styles.tableCell}>
                    {m.warehouse?.name || "—"} {m.warehouse?.address ? `(${m.warehouse.address})` : ""}
                  </span>
                  <span style={styles.tableCell}>{m.performedBy?.name || "External API"}</span>
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
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                </select>

                <label style={styles.label}>Warehouse & Facility Area</label>
                <select
                  style={styles.input}
                  value={movementForm.warehouse}
                  onChange={(e) => setMovementForm({ ...movementForm, warehouse: e.target.value })}
                  required
                >
                  <option value="">Select destination warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} — {w.address || "Area Not Set"}
                    </option>
                  ))}
                </select>

                {movementForm.warehouse && (movementForm.type === "inbound" || (movementForm.type === "adjustment" && movementForm.direction === "increase")) &&
                  renderCapacityBadge(movementForm.warehouse, movementForm.quantity)}

                <label style={styles.label}>Movement Classification</label>
                <select
                  style={styles.input}
                  value={movementForm.type}
                  onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value })}
                >
                  <option value="inbound">Inbound (Stock Arrival)</option>
                  <option value="outbound">Outbound (Dispatch / Sale)</option>
                  <option value="adjustment">Stock Adjustment (Audit)</option>
                </select>

                {movementForm.type === "inbound" && movementForm.product && movementForm.warehouse && (
                  <div style={styles.tagPreviewBox}>
                    {isProductNewToWarehouse(movementForm.product, movementForm.warehouse) ? (
                      <span style={styles.newListingTag}>
                        <Sparkles size={12} /> Initial SKU Stocking (New Listing at Location)
                      </span>
                    ) : (
                      <span style={styles.restockTag}>
                        📦 Routine Inventory Replenishment
                      </span>
                    )}
                  </div>
                )}

                {movementForm.type === "adjustment" && (
                  <>
                    <label style={styles.label}>Audit Direction</label>
                    <select
                      style={styles.input}
                      value={movementForm.direction}
                      onChange={(e) => setMovementForm({ ...movementForm, direction: e.target.value })}
                    >
                      <option value="increase">Increase Count</option>
                      <option value="decrease">Decrease Count</option>
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

                <label style={styles.label}>Reason / PO Reference</label>
                <input
                  style={styles.input}
                  placeholder="e.g. PO-84920 Supplier Delivery"
                  value={movementForm.reason}
                  onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                />

                <button style={styles.submitBtn} type="submit" disabled={saving}>
                  {saving ? "Recording..." : "Record Inbound Movement"}
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
                  {products.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>)}
                </select>

                <label style={styles.label}>From Warehouse (Source Area)</label>
                <select
                  style={styles.input}
                  value={transferForm.fromWarehouse}
                  onChange={(e) => setTransferForm({ ...transferForm, fromWarehouse: e.target.value })}
                  required
                >
                  <option value="">Select source warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>{w.name} — {w.address || "Area Not Set"}</option>
                  ))}
                </select>

                <label style={styles.label}>To Warehouse (Destination Area)</label>
                <select
                  style={styles.input}
                  value={transferForm.toWarehouse}
                  onChange={(e) => setTransferForm({ ...transferForm, toWarehouse: e.target.value })}
                  required
                >
                  <option value="">Select destination warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>{w.name} — {w.address || "Area Not Set"}</option>
                  ))}
                </select>

                {transferForm.toWarehouse && renderCapacityBadge(transferForm.toWarehouse, transferForm.quantity)}

                <label style={styles.label}>Quantity</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  required
                />

                <label style={styles.label}>Transfer Note (optional)</label>
                <input
                  style={styles.input}
                  placeholder="e.g. Balancing stock across city nodes"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                />

                <button style={styles.submitBtn} type="submit" disabled={saving}>
                  {saving ? "Executing Transfer..." : "Record Transfer"}
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
    display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 1.6fr 1fr 1fr", padding: "12px 0",
    fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
    letterSpacing: "0.03em", borderBottom: "1px solid #f1f5f9",
  },
  tableRow: {
    display: "grid", gridTemplateColumns: "1.5fr 1fr 0.6fr 1.6fr 1fr 1fr", alignItems: "center",
    padding: "12px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px",
  },
  tableCellBold: { fontWeight: 600, color: "#111827" },
  tableCellSub: { fontSize: "11px", color: "#94a3b8", marginTop: "2px" },
  tableCellBoldQty: { fontWeight: 700, color: "#0f172a" },
  tableCell: { color: "#64748b" },
  badge: { fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", width: "fit-content" },
  loadingText: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 50, padding: "20px",
  },
  modal: { background: "#fff", borderRadius: "14px", padding: "24px", width: "420px", maxWidth: "90vw", maxHeight: "85vh", overflowY: "auto" },
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
  capacityNotice: {
    padding: "8px 10px", borderRadius: "6px", background: "#f8fafc", border: "1px solid #e2e8f0",
    fontSize: "12px", color: "#64748b", marginTop: "6px",
  },
  capacityNoticeOk: {
    display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", borderRadius: "6px",
    background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "12px", color: "#16a34a", marginTop: "6px",
  },
  capacityNoticeAlert: {
    display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", borderRadius: "6px",
    background: "#fef2f2", border: "1px solid #fecaca", fontSize: "12px", color: "#dc2626", marginTop: "6px",
  },
  tagPreviewBox: { marginTop: "8px" },
  newListingTag: {
    display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 700,
    background: "#fef3c7", color: "#b45309", border: "1px solid #fde68a", padding: "4px 8px", borderRadius: "6px",
  },
  restockTag: {
    display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600,
    background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", padding: "4px 8px", borderRadius: "6px",
  },
};

export default MovementHistory;