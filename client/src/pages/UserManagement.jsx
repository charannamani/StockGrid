import { useState, useEffect } from "react";
import {
  Users,
  Shield,
  UserCheck,
  Warehouse,
  Search,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Building2,
} from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [editModal, setEditModal] = useState({
    open: false,
    user: null,
    selectedWarehouseIds: [],
  });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, whRes] = await Promise.all([
        API.get("/auth/users"),
        API.get("/warehouses"),
      ]);
      setUsers(usersRes.data || []);
      setWarehouses(whRes.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load users/warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEditModal = (targetUser) => {
    const initialIds = (targetUser.warehouses || []).map((w) =>
      typeof w === "object" ? w._id : w
    );
    setEditModal({
      open: true,
      user: targetUser,
      selectedWarehouseIds: initialIds,
    });
  };

  const closeEditModal = () => {
    setEditModal({
      open: false,
      user: null,
      selectedWarehouseIds: [],
    });
  };

  const toggleWarehouse = (whId) => {
    setEditModal((prev) => {
      const exists = prev.selectedWarehouseIds.includes(whId);
      const nextIds = exists
        ? prev.selectedWarehouseIds.filter((id) => id !== whId)
        : [...prev.selectedWarehouseIds, whId];
      return { ...prev, selectedWarehouseIds: nextIds };
    });
  };

  const selectAllWarehouses = () => {
    setEditModal((prev) => ({
      ...prev,
      selectedWarehouseIds: warehouses.map((w) => w._id),
    }));
  };

  const deselectAllWarehouses = () => {
    setEditModal((prev) => ({
      ...prev,
      selectedWarehouseIds: [],
    }));
  };

  const handleSaveWarehouses = async () => {
    if (!editModal.user) return;
    setSaving(true);
    try {
      await API.patch(`/auth/users/${editModal.user._id}/warehouses`, {
        warehouses: editModal.selectedWarehouseIds,
      });
      toast.success(`Warehouse permissions updated for ${editModal.user.name}`);
      closeEditModal();
      fetchData();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to update warehouse permissions"
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term);
    return matchesRole && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>User Management & RBAC</h1>
          <p style={styles.subtitle}>
            Assign warehouse-scoped permissions and manage staff operational boundaries
          </p>
        </div>
        <button style={styles.secondaryBtn} onClick={fetchData}>
          <RefreshCw size={15} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div style={styles.filterRow}>
        <div style={styles.searchBox}>
          <Search size={16} color="#94a3b8" />
          <input
            style={styles.searchInput}
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={styles.filterGroup}>
          <button
            style={{
              ...styles.filterBtn,
              ...(roleFilter === "all" ? styles.filterBtnActive : {}),
            }}
            onClick={() => setRoleFilter("all")}
          >
            All Users ({users.length})
          </button>
          <button
            style={{
              ...styles.filterBtn,
              ...(roleFilter === "staff" ? styles.filterBtnActive : {}),
            }}
            onClick={() => setRoleFilter("staff")}
          >
            Staff ({users.filter((u) => u.role === "staff").length})
          </button>
          <button
            style={{
              ...styles.filterBtn,
              ...(roleFilter === "admin" ? styles.filterBtnActive : {}),
            }}
            onClick={() => setRoleFilter("admin")}
          >
            Admins ({users.filter((u) => u.role === "admin").length})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div style={styles.card}>
        {loading ? (
          <div style={styles.emptyState}>Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={styles.emptyState}>
            <Users size={40} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <div style={styles.emptyTitle}>No users found</div>
            <div style={styles.emptyDesc}>Try adjusting your search or role filters.</div>
          </div>
        ) : (
          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Assigned Warehouse Locations</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isAdminUser = u.role === "admin";
                  const userWarehouses = u.warehouses || [];

                  return (
                    <tr key={u._id} className="row-hover" style={styles.tr}>
                      <td style={styles.td}>
                        <div style={styles.userCol}>
                          <div
                            style={{
                              ...styles.avatar,
                              background: isAdminUser
                                ? "linear-gradient(135deg, #ef4444, #f59e0b)"
                                : "linear-gradient(135deg, #3b82f6, #06b6d4)",
                            }}
                          >
                            {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                          </div>
                          <div>
                            <div style={styles.userName}>{u.name}</div>
                            <div style={styles.userEmail}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={styles.td}>
                        {isAdminUser ? (
                          <span style={styles.adminBadge}>
                            <Shield size={12} />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span style={styles.staffBadge}>
                            <UserCheck size={12} />
                            <span>Staff</span>
                          </span>
                        )}
                      </td>

                      <td style={styles.td}>
                        {isAdminUser ? (
                          <div style={styles.allAccessBadge}>
                            <Building2 size={13} color="#059669" />
                            <span>Full Access (All Warehouses)</span>
                          </div>
                        ) : userWarehouses.length === 0 ? (
                          <div style={styles.noAccessBadge}>
                            <AlertCircle size={13} color="#dc2626" />
                            <span>No warehouses assigned (Restricted)</span>
                          </div>
                        ) : (
                          <div style={styles.whChipContainer}>
                            {userWarehouses.map((w) => (
                              <span
                                key={typeof w === "object" ? w._id : w}
                                style={styles.whChip}
                              >
                                <Warehouse size={11} />
                                <span>{typeof w === "object" ? w.name : w}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={{ ...styles.td, textAlign: "right" }}>
                        {isAdminUser ? (
                          <span style={styles.mutedText}>Global Admin</span>
                        ) : (
                          <button
                            style={styles.editAccessBtn}
                            onClick={() => openEditModal(u)}
                          >
                            <Warehouse size={14} />
                            <span>Assign Warehouses</span>
                          </button>
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

      {/* Edit Warehouse Access Modal */}
      {editModal.open && editModal.user && (
        <div style={styles.overlay} onClick={closeEditModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  Assign Warehouses: {editModal.user.name}
                </h2>
                <p style={styles.modalSub}>
                  Select the physical distribution facilities this staff member can access
                </p>
              </div>
              <button style={styles.closeBtn} onClick={closeEditModal}>
                <X size={18} />
              </button>
            </div>

            {/* Quick selectors */}
            <div style={styles.quickSelectorsRow}>
              <span style={styles.quickCount}>
                Selected: <strong>{editModal.selectedWarehouseIds.length}</strong> of{" "}
                {warehouses.length} locations
              </span>
              <div style={styles.quickBtnGroup}>
                <button
                  type="button"
                  style={styles.textLinkBtn}
                  onClick={selectAllWarehouses}
                >
                  Select All
                </button>
                <span style={{ color: "#cbd5e1" }}>•</span>
                <button
                  type="button"
                  style={styles.textLinkBtn}
                  onClick={deselectAllWarehouses}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Warehouse Checkbox List */}
            <div style={styles.warehouseList}>
              {warehouses.length === 0 ? (
                <div style={styles.noWarehousesNotice}>
                  No warehouses configured yet in the system.
                </div>
              ) : (
                warehouses.map((wh) => {
                  const isChecked = editModal.selectedWarehouseIds.includes(wh._id);
                  return (
                    <label
                      key={wh._id}
                      style={{
                        ...styles.whOptionLabel,
                        borderColor: isChecked ? "#f97316" : "#e2e8f0",
                        backgroundColor: isChecked ? "#fffaf5" : "#ffffff",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleWarehouse(wh._id)}
                        style={styles.checkbox}
                      />
                      <div style={styles.whOptionInfo}>
                        <div style={styles.whOptionName}>{wh.name}</div>
                        <div style={styles.whOptionAddress}>
                          {wh.address || "Area Not Specified"}
                          {wh.capacity != null ? ` • Capacity: ${wh.capacity} units` : ""}
                        </div>
                      </div>
                      {isChecked && (
                        <div style={styles.checkedIndicator}>
                          <Check size={14} color="#ea580c" />
                        </div>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.modalCancelBtn}
                onClick={closeEditModal}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.modalSubmitBtn}
                disabled={saving}
                onClick={handleSaveWarehouses}
              >
                {saving ? "Saving..." : "Save Permissions"}
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
    marginBottom: "20px",
    gap: "16px",
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
  filterRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "16px",
    flexWrap: "wrap",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "7px 12px",
    width: "280px",
  },
  searchInput: {
    border: "none",
    outline: "none",
    fontSize: "13px",
    width: "100%",
    color: "#1e293b",
  },
  filterGroup: {
    display: "flex",
    gap: "6px",
  },
  filterBtn: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#64748b",
    padding: "6px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  filterBtnActive: {
    background: "#f1f5f9",
    color: "#0f172a",
    borderColor: "#cbd5e1",
    fontWeight: 600,
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
    transition: "background-color 0.15s ease",
    cursor: "default",
  },
  td: {
    padding: "13px 16px",
    verticalAlign: "middle",
  },
  userCol: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  avatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userName: {
    fontWeight: 600,
    color: "#1e293b",
  },
  userEmail: {
    fontSize: "12px",
    color: "#64748b",
  },
  adminBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "999px",
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fee2e2",
  },
  staffBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "999px",
    background: "#eff6ff",
    color: "#2563eb",
    border: "1px solid #dbeafe",
  },
  allAccessBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#059669",
    fontWeight: 500,
  },
  noAccessBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: "#dc2626",
    fontWeight: 500,
  },
  whChipContainer: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  whChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    fontWeight: 500,
    color: "#334155",
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: "2px 8px",
    borderRadius: "6px",
  },
  editAccessBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    background: "#ffffff",
    border: "1px solid #cbd5e1",
    color: "#334155",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 0.1s",
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
    background: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
    animation: "backdropEnter 0.2s ease both",
  },
  modal: {
    background: "#ffffff",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "520px",
    padding: "24px",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    animation: "modalEnter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "16px",
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
  quickSelectorsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
    fontSize: "12px",
  },
  quickCount: {
    color: "#475569",
  },
  quickBtnGroup: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
  },
  textLinkBtn: {
    background: "transparent",
    border: "none",
    color: "#ea580c",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  warehouseList: {
    maxHeight: "280px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginBottom: "20px",
  },
  noWarehousesNotice: {
    padding: "16px",
    textAlign: "center",
    fontSize: "13px",
    color: "#94a3b8",
  },
  whOptionLabel: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#ea580c",
    cursor: "pointer",
  },
  whOptionInfo: {
    flex: 1,
  },
  whOptionName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1e293b",
  },
  whOptionAddress: {
    fontSize: "11px",
    color: "#64748b",
  },
  checkedIndicator: {
    display: "flex",
    alignItems: "center",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
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
};

export default UserManagement;
