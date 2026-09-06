import { useState, useEffect } from "react";
import {
  BookmarkCheck,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const emptyForm = {
  productId: "",
  warehouseId: "",
  quantity: "",
  clientReference: "",
};

const STATUS_CONFIG = {
  pending: {
    label: "Active Hold",
    bg: "#fffbeb",
    color: "#b45309",
    border: "#fef3c7",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    bg: "#ecfdf5",
    color: "#047857",
    border: "#d1fae5",
    icon: CheckCircle2,
  },
  released: {
    label: "Released / Expired",
    bg: "#f8fafc",
    color: "#64748b",
    border: "#e2e8f0",
    icon: XCircle,
  },
};

const Reservations = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [stockMap, setStockMap] = useState({});

  const [filterProduct, setFilterProduct] = useState("");
  const [filterWarehouse, setFilterWarehouse] = useState("");

  const [showReserveModal, setShowReserveModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    reservation: null,
    orderId: "",
  });
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Update clock every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const canActOnWarehouse = (warehouseId) => {
    if (isAdmin) return true;
    if (!user?.warehouses || !warehouseId) return false;
    const targetId = typeof warehouseId === "object" ? warehouseId._id : warehouseId;
    return user.warehouses.some((w) => {
      const userWhId = typeof w === "object" ? w._id : w;
      return userWhId?.toString() === targetId?.toString();
    });
  };

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterProduct) params.product = filterProduct;
      if (filterWarehouse) params.warehouse = filterWarehouse;
      const res = await API.get("/stock/reservations", { params });
      setReservations(res.data?.reservations || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load reservations");
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

  const fetchWarehouseStock = async (whId) => {
    if (!whId) return;
    try {
      const res = await API.get(`/stock/warehouse/${whId}`);
      const stockList = Array.isArray(res.data) ? res.data : res.data.stock || [];
      const map = {};
      stockList.forEach((item) => {
        const pId = item.product?._id || item.product;
        map[pId] = {
          currentQuantity: item.currentQuantity || 0,
          reservedQuantity: item.reservedQuantity || 0,
          available: (item.currentQuantity || 0) - (item.reservedQuantity || 0),
        };
      });
      setStockMap(map);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRefs();
  }, []);

  useEffect(() => {
    fetchReservations();
  }, [filterProduct, filterWarehouse]);

  useEffect(() => {
    if (form.warehouseId) {
      fetchWarehouseStock(form.warehouseId);
    } else {
      setStockMap({});
    }
  }, [form.warehouseId]);

  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
    toast.success("Reservation ID copied to clipboard");
  };

  const handleCreateReservation = async (e) => {
    e.preventDefault();
    const qty = Number(form.quantity);
    if (!form.productId || !form.warehouseId || !qty || qty <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        productId: form.productId,
        warehouseId: form.warehouseId,
        quantity: qty,
        clientReference: form.clientReference.trim() || undefined,
      };
      const res = await API.post("/stock/reserve", payload);
      toast.success(
        `Reservation ${res.data.reservationId} confirmed! 10-minute hold active.`
      );
      setShowReserveModal(false);
      setForm(emptyForm);
      fetchReservations();
      if (form.warehouseId) fetchWarehouseStock(form.warehouseId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create reservation");
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirmModal = (r) => {
    setConfirmModal({
      open: true,
      reservation: r,
      orderId: r.clientReference || "",
    });
  };

  const handleConfirmReservation = async () => {
    if (!confirmModal.reservation) return;
    const rId = confirmModal.reservation.reservationId;
    setActionLoadingId(rId);
    try {
      await API.post("/stock/confirm", {
        reservationId: rId,
        orderId: confirmModal.orderId.trim() || undefined,
      });
      toast.success(`Hold ${rId} confirmed & stock permanently deducted!`);
      setConfirmModal({ open: false, reservation: null, orderId: "" });
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm reservation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReleaseReservation = async (r) => {
    if (
      !window.confirm(
        `Release hold ${r.reservationId}? The ${r.quantity} held units will immediately return to available stock.`
      )
    ) {
      return;
    }
    setActionLoadingId(r.reservationId);
    try {
      await API.post("/stock/release", { reservationId: r.reservationId });
      toast.success(`Hold ${r.reservationId} released. Stock returned.`);
      fetchReservations();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to release reservation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredReservations = reservations.filter((r) => {
    if (activeTab === "all") return true;
    return r.status === activeTab;
  });

  const getCountdown = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) return "Expired (queue releasing)";
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds < 10 ? "0" : ""}${seconds}s left`;
  };

  const pendingCount = reservations.filter((r) => r.status === "pending").length;
  const confirmedCount = reservations.filter((r) => r.status === "confirmed").length;
  const releasedCount = reservations.filter((r) => r.status === "released").length;

  const currentAvailableToPromise =
    form.productId && stockMap[form.productId]
      ? stockMap[form.productId].available
      : null;

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Stock Reservations</h1>
          <p style={styles.subtitle}>
            Atomic inventory holds with 10-minute auto-release BullMQ background workers
          </p>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.secondaryBtn} onClick={fetchReservations}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <button
            style={styles.primaryBtn}
            onClick={() => {
              setForm(emptyForm);
              setShowReserveModal(true);
            }}
          >
            <Plus size={16} />
            <span>New Hold</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabsRow}>
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(activeTab === "pending" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("pending")}
          >
            <Clock size={15} />
            <span>Active Holds</span>
            <span style={styles.badge}>{pendingCount}</span>
          </button>

          <button
            style={{
              ...styles.tab,
              ...(activeTab === "confirmed" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("confirmed")}
          >
            <CheckCircle2 size={15} />
            <span>Confirmed</span>
            <span style={styles.badge}>{confirmedCount}</span>
          </button>

          <button
            style={{
              ...styles.tab,
              ...(activeTab === "released" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("released")}
          >
            <XCircle size={15} />
            <span>Released</span>
            <span style={styles.badge}>{releasedCount}</span>
          </button>

          <button
            style={{
              ...styles.tab,
              ...(activeTab === "all" ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab("all")}
          >
            <span>All Holds</span>
            <span style={styles.badge}>{reservations.length}</span>
          </button>
        </div>

        {/* Filters */}
        <div style={styles.filterGroup}>
          <select
            style={styles.filterSelect}
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            style={styles.filterSelect}
            value={filterWarehouse}
            onChange={(e) => setFilterWarehouse(e.target.value)}
          >
            <option value="">All Warehouses</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div style={styles.card}>
        {loading ? (
          <div style={styles.emptyState}>Loading reservations...</div>
        ) : filteredReservations.length === 0 ? (
          <div style={styles.emptyState}>
            <BookmarkCheck size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <div style={styles.emptyTitle}>No reservations found</div>
            <div style={styles.emptyDesc}>
              {activeTab === "pending"
                ? "No active stock holds at the moment. Create a new hold above."
                : "No reservations match this filter selection."}
            </div>
          </div>
        ) : (
          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Reservation ID</th>
                  <th style={styles.th}>Product & SKU</th>
                  <th style={styles.th}>Warehouse</th>
                  <th style={styles.th}>Hold Qty</th>
                  <th style={styles.th}>Reference / Order</th>
                  <th style={styles.th}>Status & Timer</th>
                  <th style={styles.th}>Created</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((r) => {
                  const statusConf = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;
                  const isPending = r.status === "pending";
                  const canAct = canActOnWarehouse(r.warehouse?._id || r.warehouse);
                  const isActionLoading = actionLoadingId === r.reservationId;
                  const countdownText = isPending ? getCountdown(r.expiresAt) : null;
                  const isPastDue =
                    isPending && new Date(r.expiresAt).getTime() <= now;

                  return (
                    <tr key={r._id} style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.idContainer}>
                          <span style={styles.codeText}>{r.reservationId}</span>
                          <button
                            style={styles.copyBtn}
                            onClick={() => handleCopy(r.reservationId)}
                            title="Copy ID"
                          >
                            {copiedId === r.reservationId ? (
                              <Check size={13} color="#16a34a" />
                            ) : (
                              <Copy size={13} color="#94a3b8" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.productName}>
                          {r.product?.name || "Product"}
                        </div>
                        <div style={styles.productSku}>
                          {r.product?.sku || "SKU N/A"}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.whName}>
                          {r.warehouse?.name || "Warehouse"}
                        </div>
                        <div style={styles.whSub}>
                          {r.warehouse?.address || "Primary Hub"}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.qtyBadge}>
                          {r.quantity.toLocaleString()} units
                        </span>
                      </td>

                      <td style={styles.td}>
                        {r.clientReference ? (
                          <span style={styles.refBadge}>{r.clientReference}</span>
                        ) : (
                          <span style={styles.mutedText}>—</span>
                        )}
                      </td>

                      <td style={styles.td}>
                        <div style={styles.statusCol}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              backgroundColor: statusConf.bg,
                              color: statusConf.color,
                              borderColor: statusConf.border,
                            }}
                          >
                            <StatusIcon size={13} />
                            <span>{statusConf.label}</span>
                          </span>

                          {isPending && (
                            <span
                              style={{
                                ...styles.countdownTag,
                                color: isPastDue ? "#dc2626" : "#b45309",
                              }}
                            >
                              <Clock size={11} />
                              <span>{countdownText}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <span style={styles.timeText}>
                          {new Date(r.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>

                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {isPending ? (
                          <div style={styles.actionButtons}>
                            <button
                              style={{
                                ...styles.confirmBtn,
                                opacity: !canAct || isActionLoading ? 0.6 : 1,
                                cursor:
                                  !canAct || isActionLoading ? "not-allowed" : "pointer",
                              }}
                              disabled={!canAct || isActionLoading}
                              onClick={() => openConfirmModal(r)}
                              title={
                                !canAct
                                  ? "Permission required for this warehouse"
                                  : "Fulfill / Deduct Stock"
                              }
                            >
                              Confirm
                            </button>
                            <button
                              style={{
                                ...styles.releaseBtn,
                                opacity: !canAct || isActionLoading ? 0.6 : 1,
                                cursor:
                                  !canAct || isActionLoading ? "not-allowed" : "pointer",
                              }}
                              disabled={!canAct || isActionLoading}
                              onClick={() => handleReleaseReservation(r)}
                              title={
                                !canAct
                                  ? "Permission required for this warehouse"
                                  : "Release reserved units back to available stock"
                              }
                            >
                              Release
                            </button>
                          </div>
                        ) : (
                          <span style={styles.mutedText}>No actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Reservation Modal */}
      {showReserveModal && (
        <div style={styles.overlay} onClick={() => setShowReserveModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>New Stock Hold (Reservation)</h2>
                <p style={styles.modalSub}>
                  Temporarily lock inventory to prevent concurrent overselling
                </p>
              </div>
              <button
                style={styles.closeBtn}
                onClick={() => setShowReserveModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateReservation}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Warehouse Location *</label>
                <select
                  style={styles.input}
                  value={form.warehouseId}
                  onChange={(e) =>
                    setForm({ ...form, warehouseId: e.target.value })
                  }
                  required
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} {w.address ? `(${w.address})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Product to Hold *</label>
                <select
                  style={styles.input}
                  value={form.productId}
                  onChange={(e) =>
                    setForm({ ...form, productId: e.target.value })
                  }
                  required
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock availability indicator */}
              {form.warehouseId && form.productId && (
                <div style={styles.stockAvailabilityBox}>
                  {currentAvailableToPromise != null ? (
                    currentAvailableToPromise > 0 ? (
                      <div style={styles.stockAvailableOk}>
                        <CheckCircle2 size={14} color="#16a34a" />
                        <span>
                          Available to Promise: <strong>{currentAvailableToPromise}</strong> units
                        </span>
                      </div>
                    ) : (
                      <div style={styles.stockAvailableWarn}>
                        <AlertCircle size={14} color="#dc2626" />
                        <span>
                          No sellable stock available at this warehouse (Available: 0)
                        </span>
                      </div>
                    )
                  ) : (
                    <div style={styles.stockAvailableWarn}>
                      <AlertCircle size={14} color="#b45309" />
                      <span>Checking stock levels...</span>
                    </div>
                  )}
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>Quantity *</label>
                <input
                  style={styles.input}
                  type="number"
                  min="1"
                  max={
                    currentAvailableToPromise && currentAvailableToPromise > 0
                      ? currentAvailableToPromise
                      : undefined
                  }
                  placeholder="e.g. 5"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Client Reference / Order ID (Optional)
                </label>
                <input
                  style={styles.input}
                  placeholder="e.g. CART-9402, Web Checkout #8172"
                  value={form.clientReference}
                  onChange={(e) =>
                    setForm({ ...form, clientReference: e.target.value })
                  }
                />
              </div>

              <div style={styles.ttlNotice}>
                <Clock size={15} color="#b45309" />
                <span>
                  Holds automatically expire in <strong>10 minutes</strong>. If not confirmed, a background worker will restore the units to sellable stock.
                </span>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.modalCancelBtn}
                  onClick={() => setShowReserveModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={styles.modalSubmitBtn}
                  disabled={submitting}
                >
                  {submitting ? "Placing Hold..." : "Lock Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Hold Modal */}
      {confirmModal.open && confirmModal.reservation && (
        <div
          style={styles.overlay}
          onClick={() =>
            setConfirmModal({ open: false, reservation: null, orderId: "" })
          }
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Confirm Stock Hold</h2>
                <p style={styles.modalSub}>
                  Permanently deduct held stock and finalize order fulfillment
                </p>
              </div>
              <button
                style={styles.closeBtn}
                onClick={() =>
                  setConfirmModal({ open: false, reservation: null, orderId: "" })
                }
              >
                <X size={18} />
              </button>
            </div>

            <div style={styles.confirmDetailsBox}>
              <div style={styles.confirmRow}>
                <span style={styles.confirmLabel}>Reservation ID:</span>
                <span style={styles.confirmVal}>
                  {confirmModal.reservation.reservationId}
                </span>
              </div>
              <div style={styles.confirmRow}>
                <span style={styles.confirmLabel}>Product:</span>
                <span style={styles.confirmVal}>
                  {confirmModal.reservation.product?.name} (
                  {confirmModal.reservation.product?.sku})
                </span>
              </div>
              <div style={styles.confirmRow}>
                <span style={styles.confirmLabel}>Held Quantity:</span>
                <span style={styles.confirmVal}>
                  <strong>{confirmModal.reservation.quantity} units</strong>
                </span>
              </div>
              <div style={styles.confirmRow}>
                <span style={styles.confirmLabel}>Warehouse:</span>
                <span style={styles.confirmVal}>
                  {confirmModal.reservation.warehouse?.name}
                </span>
              </div>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>
                Final Order ID / Invoice Ref (Optional)
              </label>
              <input
                style={styles.input}
                placeholder="e.g. ORD-10924"
                value={confirmModal.orderId}
                onChange={(e) =>
                  setConfirmModal({ ...confirmModal, orderId: e.target.value })
                }
              />
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalCancelBtn}
                onClick={() =>
                  setConfirmModal({
                    open: false,
                    reservation: null,
                    orderId: "",
                  })
                }
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.modalConfirmBtn}
                disabled={actionLoadingId === confirmModal.reservation.reservationId}
                onClick={handleConfirmReservation}
              >
                {actionLoadingId === confirmModal.reservation.reservationId
                  ? "Deducting..."
                  : "Confirm & Deduct Stock"}
              </button>
            </div>
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
    marginBottom: "24px",
    gap: "16px",
  },
  headerRight: {
    display: "flex",
    gap: "10px",
    alignItems: "center",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 4px 0",
  },
  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    margin: 0,
  },
  primaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 4px rgba(239, 68, 68, 0.2)",
    transition: "opacity 0.2s",
  },
  secondaryBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    color: "#475569",
    borderRadius: "8px",
    padding: "9px 14px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  tabsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "16px",
    flexWrap: "wrap",
  },
  tabs: {
    display: "flex",
    gap: "6px",
    background: "#f1f5f9",
    padding: "4px",
    borderRadius: "10px",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    background: "transparent",
    padding: "7px 14px",
    borderRadius: "7px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#64748b",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  tabActive: {
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 600,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  badge: {
    fontSize: "11px",
    background: "#e2e8f0",
    color: "#334155",
    padding: "1px 6px",
    borderRadius: "999px",
    fontWeight: 600,
  },
  filterGroup: {
    display: "flex",
    gap: "10px",
  },
  filterSelect: {
    padding: "7px 12px",
    fontSize: "13px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#fff",
    color: "#334155",
    outline: "none",
  },
  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  tableResponsive: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: "13px",
  },
  th: {
    padding: "12px 16px",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 600,
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid #f1f5f9",
    transition: "background 0.1s",
  },
  td: {
    padding: "13px 16px",
    verticalAlign: "middle",
  },
  idContainer: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  codeText: {
    fontFamily: "monospace",
    fontSize: "12px",
    color: "#0f172a",
    background: "#f1f5f9",
    padding: "2px 6px",
    borderRadius: "4px",
    fontWeight: 600,
  },
  copyBtn: {
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: "2px",
    display: "flex",
    alignItems: "center",
  },
  productName: {
    fontWeight: 600,
    color: "#1e293b",
  },
  productSku: {
    fontSize: "11px",
    color: "#64748b",
  },
  whName: {
    fontWeight: 500,
    color: "#334155",
  },
  whSub: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  qtyBadge: {
    fontWeight: 600,
    color: "#0f172a",
  },
  refBadge: {
    fontSize: "12px",
    color: "#475569",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  statusCol: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    alignItems: "flex-start",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "999px",
    border: "1px solid",
  },
  countdownTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: 600,
  },
  timeText: {
    fontSize: "12px",
    color: "#64748b",
  },
  actionButtons: {
    display: "flex",
    gap: "6px",
    justifyContent: "flex-end",
  },
  confirmBtn: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  releaseBtn: {
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    padding: "5px 10px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  mutedText: {
    color: "#94a3b8",
    fontSize: "12px",
  },
  emptyState: {
    padding: "48px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#334155",
    marginBottom: "4px",
  },
  emptyDesc: {
    fontSize: "13px",
    color: "#64748b",
  },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.5)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "#ffffff",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "500px",
    padding: "24px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#111827",
    margin: "0 0 4px 0",
  },
  modalSub: {
    fontSize: "12px",
    color: "#64748b",
    margin: 0,
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
  },
  formGroup: {
    marginBottom: "16px",
  },
  label: {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#374151",
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    fontSize: "13px",
    color: "#111827",
    boxSizing: "border-box",
    outline: "none",
  },
  stockAvailabilityBox: {
    marginBottom: "16px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },
  stockAvailableOk: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#16a34a",
    fontSize: "12px",
  },
  stockAvailableWarn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#dc2626",
    fontSize: "12px",
  },
  ttlNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "10px 12px",
    background: "#fffbeb",
    border: "1px solid #fef3c7",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#92400e",
    marginBottom: "20px",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px",
  },
  modalCancelBtn: {
    padding: "9px 16px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  modalSubmitBtn: {
    padding: "9px 18px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  modalConfirmBtn: {
    padding: "9px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#16a34a",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  confirmDetailsBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "12px 14px",
    marginBottom: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  confirmRow: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
  },
  confirmLabel: {
    color: "#64748b",
  },
  confirmVal: {
    color: "#1e293b",
    fontWeight: 500,
  },
};

export default Reservations;
