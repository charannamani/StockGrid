import { useState, useEffect } from "react";
import {
  Truck,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  X,
  AlertCircle,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const emptyForm = {
  product: "",
  fromWarehouse: "",
  toWarehouse: "",
  quantity: "",
  notes: "",
};

const STATUS_STYLES = {
  in_transit: {
    label: "In Transit",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fef3c7",
    icon: Clock,
  },
  received: {
    label: "Received",
    bg: "#ecfdf5",
    color: "#047857",
    border: "#d1fae5",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "#fee2e2",
    icon: XCircle,
  },
};

const Transfers = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("in_transit");

  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [initiateForm, setInitiateForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [cancelModal, setCancelModal] = useState({
    open: false,
    transfer: null,
    notes: "",
  });
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const res = await API.get("/transfers");
      setTransfers(res.data?.transfers || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load transfers");
    } finally {
      setLoading(false);
    }
  };

  const fetchRefs = async () => {
    try {
      const [prodRes, whRes] = await Promise.all([
        API.get("/products"),
        API.get("/warehouses"),
      ]);
      setProducts(prodRes.data || []);
      setWarehouses(whRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchRefs();
  }, []);

  const canActOnWarehouse = (warehouse) => {
    if (!user) return false;
    if (isAdmin) return true;
    const whId = warehouse?._id || warehouse;
    if (!whId || !Array.isArray(user.warehouses)) return false;
    return user.warehouses.some(
      (w) => (w?._id ? w._id.toString() : w.toString()) === whId.toString()
    );
  };

  const handleInitiateSubmit = async (e) => {
    e.preventDefault();

    if (initiateForm.fromWarehouse === initiateForm.toWarehouse) {
      toast.error("Source and destination warehouses cannot be identical");
      return;
    }

    if (Number(initiateForm.quantity) <= 0) {
      toast.error("Transfer quantity must be greater than zero");
      return;
    }

    setSubmitting(true);
    try {
      await API.post("/transfers", {
        product: initiateForm.product,
        fromWarehouse: initiateForm.fromWarehouse,
        toWarehouse: initiateForm.toWarehouse,
        quantity: Number(initiateForm.quantity),
        notes: initiateForm.notes || undefined,
      });

      toast.success("Transfer initiated successfully");
      setShowInitiateModal(false);
      setInitiateForm(emptyForm);
      fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to initiate transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (transfer) => {
    if (!canActOnWarehouse(transfer.toWarehouse)) {
      toast.error("You do not have access to destination warehouse");
      return;
    }

    setActionLoadingId(transfer._id);
    try {
      await API.post(`/transfers/${transfer._id}/confirm`);
      toast.success("Transfer confirmed! Stock credited to destination.");
      fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm transfer");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    const { transfer, notes } = cancelModal;
    if (!transfer) return;

    setActionLoadingId(transfer._id);
    try {
      await API.post(`/transfers/${transfer._id}/cancel`, { notes });
      toast.success("Transfer cancelled. Stock restored to source warehouse.");
      setCancelModal({ open: false, transfer: null, notes: "" });
      fetchTransfers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel transfer");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredTransfers = transfers.filter((t) => {
    if (activeTab === "all") return true;
    return t.status === activeTab;
  });

  const inTransitCount = transfers.filter((t) => t.status === "in_transit").length;

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Stock Transfers</h1>
          <p style={styles.subtitle}>
            Two-phase custody transfers with atomic ledger verification
          </p>
        </div>
        <button
          style={styles.primaryBtn}
          onClick={() => setShowInitiateModal(true)}
        >
          <Plus size={16} />
          <span>Initiate Transfer</span>
        </button>
      </div>

      <div style={styles.tabRow}>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "in_transit" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("in_transit")}
        >
          <span>In Transit</span>
          {inTransitCount > 0 && (
            <span style={styles.badgeCount}>{inTransitCount}</span>
          )}
        </button>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "received" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("received")}
        >
          Received
        </button>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "cancelled" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("cancelled")}
        >
          Cancelled
        </button>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "all" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("all")}
        >
          All Transfers
        </button>
      </div>

      <div style={styles.container}>
        {loading ? (
          <div style={styles.loadingText}>Loading transfers...</div>
        ) : filteredTransfers.length === 0 ? (
          <div style={styles.emptyContainer}>
            <Truck size={36} color="#cbd5e1" />
            <p style={styles.emptyTitle}>No transfers found</p>
            <p style={styles.emptySub}>
              {activeTab === "in_transit"
                ? "There are no pending transfers in transit right now."
                : "No transfer records match this status."}
            </p>
          </div>
        ) : (
          <div style={styles.table}>
            <div style={styles.tableHead}>
              <span>Product</span>
              <span>Route (From → To)</span>
              <span>Qty</span>
              <span>Status</span>
              <span>Initiated</span>
              <span>Received / Cancelled</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            {filteredTransfers.map((t) => {
              const s = STATUS_STYLES[t.status] || STATUS_STYLES.in_transit;
              const StatusIcon = s.icon;
              const canConfirm = canActOnWarehouse(t.toWarehouse);
              const canCancel = canActOnWarehouse(t.fromWarehouse);
              const isActing = actionLoadingId === t._id;

              return (
                <div key={t._id} style={styles.tableRow}>
                  <div>
                    <div style={styles.boldCell}>{t.product?.name || "—"}</div>
                    <div style={styles.subCell}>{t.product?.sku || "SKU-UNKNOWN"}</div>
                  </div>

                  <div style={styles.routeCell}>
                    <span style={styles.sourceTag}>
                      {t.fromWarehouse?.name || "—"}
                    </span>
                    <ArrowRight size={14} color="#94a3b8" />
                    <span style={styles.destTag}>
                      {t.toWarehouse?.name || "—"}
                    </span>
                  </div>

                  <div>
                    <span style={styles.qtyCell}>{t.quantity}</span>
                  </div>

                  <div>
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: s.bg,
                        color: s.color,
                        borderColor: s.border,
                      }}
                    >
                      <StatusIcon size={12} />
                      <span>{s.label}</span>
                    </span>
                  </div>

                  <div>
                    <div style={styles.subCellBold}>
                      {t.initiatedBy?.name || "Admin"}
                    </div>
                    <div style={styles.subCell}>
                      {t.initiatedAt
                        ? new Date(t.initiatedAt).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>

                  <div>
                    {t.status === "received" && (
                      <>
                        <div style={styles.subCellBold}>
                          {t.receivedBy?.name || "Staff"}
                        </div>
                        <div style={styles.subCell}>
                          {t.receivedAt
                            ? new Date(t.receivedAt).toLocaleDateString()
                            : "—"}
                        </div>
                      </>
                    )}
                    {t.status === "cancelled" && (
                      <div style={styles.subCell}>
                        {t.cancelledAt
                          ? new Date(t.cancelledAt).toLocaleDateString()
                          : "—"}
                      </div>
                    )}
                    {t.status === "in_transit" && (
                      <span style={styles.pendingText}>Awaiting Arrival</span>
                    )}
                  </div>

                  <div style={styles.actionCell}>
                    {t.status === "in_transit" ? (
                      <div style={styles.btnGroup}>
                        <button
                          style={{
                            ...styles.confirmBtn,
                            ...(!canConfirm ? styles.btnDisabled : {}),
                          }}
                          disabled={!canConfirm || isActing}
                          title={
                            canConfirm
                              ? "Confirm receipt and credit stock to destination"
                              : "You don't have access to destination warehouse"
                          }
                          onClick={() => handleConfirm(t)}
                        >
                          <CheckCircle2 size={14} />
                          <span>Receive</span>
                        </button>
                        <button
                          style={{
                            ...styles.cancelBtn,
                            ...(!canCancel ? styles.btnDisabled : {}),
                          }}
                          disabled={!canCancel || isActing}
                          title={
                            canCancel
                              ? "Cancel transfer and return stock to source"
                              : "You don't have access to source warehouse"
                          }
                          onClick={() =>
                            setCancelModal({
                              open: true,
                              transfer: t,
                              notes: "",
                            })
                          }
                        >
                          <Ban size={14} />
                          <span>Cancel</span>
                        </button>
                      </div>
                    ) : (
                      <span style={styles.closedText}>Completed</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showInitiateModal && (
        <div style={styles.overlay} onClick={() => setShowInitiateModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitleRow}>
                <div style={styles.modalIcon}>
                  <Truck size={18} color="#ea580c" />
                </div>
                <h2 style={styles.modalTitle}>Initiate Transfer</h2>
              </div>
              <button
                style={styles.closeBtn}
                onClick={() => setShowInitiateModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleInitiateSubmit}>
              <label style={styles.label}>Product</label>
              <select
                style={styles.input}
                value={initiateForm.product}
                onChange={(e) =>
                  setInitiateForm({ ...initiateForm, product: e.target.value })
                }
                required
              >
                <option value="">Select product to move</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>

              <div style={styles.row}>
                <div style={styles.col}>
                  <label style={styles.label}>Source Warehouse</label>
                  <select
                    style={styles.input}
                    value={initiateForm.fromWarehouse}
                    onChange={(e) =>
                      setInitiateForm({
                        ...initiateForm,
                        fromWarehouse: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select origin</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.col}>
                  <label style={styles.label}>Destination Warehouse</label>
                  <select
                    style={styles.input}
                    value={initiateForm.toWarehouse}
                    onChange={(e) =>
                      setInitiateForm({
                        ...initiateForm,
                        toWarehouse: e.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select target</option>
                    {warehouses.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {initiateForm.fromWarehouse &&
                initiateForm.toWarehouse &&
                initiateForm.fromWarehouse === initiateForm.toWarehouse && (
                  <div style={styles.errorBanner}>
                    <AlertCircle size={14} />
                    <span>Source and destination warehouses cannot be identical</span>
                  </div>
                )}

              <label style={styles.label}>Transfer Quantity</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                placeholder="e.g. 50"
                value={initiateForm.quantity}
                onChange={(e) =>
                  setInitiateForm({
                    ...initiateForm,
                    quantity: e.target.value,
                  })
                }
                required
              />

              <label style={styles.label}>Notes / Manifest Ref (Optional)</label>
              <input
                style={styles.input}
                placeholder="e.g. Urgent redistribution for seasonal spike"
                value={initiateForm.notes}
                onChange={(e) =>
                  setInitiateForm({ ...initiateForm, notes: e.target.value })
                }
              />

              <button style={styles.submitBtn} type="submit" disabled={submitting}>
                {submitting ? "Initiating..." : "Dispatch Stock (Phase 1)"}
              </button>
            </form>
          </div>
        </div>
      )}

      {cancelModal.open && (
        <div
          style={styles.overlay}
          onClick={() =>
            setCancelModal({ open: false, transfer: null, notes: "" })
          }
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Cancel In-Transit Transfer</h2>
              <button
                style={styles.closeBtn}
                onClick={() =>
                  setCancelModal({ open: false, transfer: null, notes: "" })
                }
              >
                <X size={18} />
              </button>
            </div>

            <p style={styles.confirmPrompt}>
              Are you sure you want to recall this shipment? The transferred
              stock of <strong>{cancelModal.transfer?.quantity} units</strong>{" "}
              will be immediately returned to{" "}
              <strong>{cancelModal.transfer?.fromWarehouse?.name}</strong>.
            </p>

            <form onSubmit={handleCancelSubmit}>
              <label style={styles.label}>Reason for Cancellation</label>
              <input
                style={styles.input}
                placeholder="e.g. Dispatch vehicle breakdown / Wrong SKU"
                value={cancelModal.notes}
                onChange={(e) =>
                  setCancelModal({ ...cancelModal, notes: e.target.value })
                }
              />

              <div style={styles.modalBtnRow}>
                <button
                  type="button"
                  style={styles.cancelActionSecondary}
                  onClick={() =>
                    setCancelModal({ open: false, transfer: null, notes: "" })
                  }
                >
                  Never mind
                </button>
                <button
                  type="submit"
                  style={styles.cancelActionPrimary}
                  disabled={actionLoadingId === cancelModal.transfer?._id}
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  title: { fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "4px" },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  tabRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "8px",
  },
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  tabBtnActive: {
    background: "linear-gradient(135deg, #fef2f2, #fff7ed)",
    color: "#ea580c",
    fontWeight: 600,
  },
  badgeCount: {
    background: "#ea580c",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: "10px",
  },
  container: {
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },
  loadingText: { padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "14px" },
  emptyContainer: {
    padding: "60px 20px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  emptyTitle: { fontSize: "15px", fontWeight: 600, color: "#334155", margin: 0 },
  emptySub: { fontSize: "13px", color: "#94a3b8", margin: 0 },
  table: { display: "flex", flexDirection: "column" },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1.8fr 2fr 0.8fr 1.2fr 1.2fr 1.4fr 1.6fr",
    padding: "12px 18px",
    background: "#f8fafc",
    borderBottom: "1px solid #e5e7eb",
    fontSize: "12px",
    fontWeight: 600,
    color: "#64748b",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.8fr 2fr 0.8fr 1.2fr 1.2fr 1.4fr 1.6fr",
    padding: "14px 18px",
    borderBottom: "1px solid #f1f5f9",
    alignItems: "center",
    fontSize: "13px",
  },
  boldCell: { fontWeight: 600, color: "#111827" },
  subCell: { fontSize: "12px", color: "#94a3b8", marginTop: "2px" },
  subCellBold: { fontSize: "12px", fontWeight: 600, color: "#334155" },
  qtyCell: { fontWeight: 700, color: "#111827", fontSize: "14px" },
  routeCell: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  sourceTag: {
    background: "#f1f5f9",
    color: "#334155",
    padding: "3px 7px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 500,
  },
  destTag: {
    background: "#fff7ed",
    color: "#c2410c",
    padding: "3px 7px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: 500,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "3px 9px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
    border: "1px solid",
  },
  pendingText: { fontSize: "12px", color: "#ea580c", fontStyle: "italic" },
  closedText: { fontSize: "12px", color: "#94a3b8" },
  actionCell: { display: "flex", justifyContent: "flex-end" },
  btnGroup: { display: "flex", gap: "6px" },
  confirmBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 10px",
    borderRadius: "6px",
    border: "none",
    background: "#059669",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #fee2e2",
    background: "#fff",
    color: "#e11d48",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    pointerEvents: "none",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    background: "#fff",
    borderRadius: "14px",
    padding: "24px",
    width: "480px",
    maxWidth: "92vw",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  modalTitleRow: { display: "flex", alignItems: "center", gap: "8px" },
  modalIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "#fff7ed",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "#111827", margin: 0 },
  closeBtn: { border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#475569",
    marginBottom: "6px",
    marginTop: "12px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  row: { display: "flex", gap: "12px" },
  col: { flex: 1 },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: "12px",
    padding: "8px 10px",
    borderRadius: "6px",
    marginTop: "8px",
  },
  confirmPrompt: {
    fontSize: "14px",
    color: "#475569",
    lineHeight: "1.5",
    marginBottom: "16px",
  },
  modalBtnRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "20px",
  },
  cancelActionSecondary: {
    padding: "9px 14px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  cancelActionPrimary: {
    padding: "9px 16px",
    borderRadius: "8px",
    border: "none",
    background: "#e11d48",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  submitBtn: {
    width: "100%",
    marginTop: "22px",
    padding: "11px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
};

export default Transfers;
