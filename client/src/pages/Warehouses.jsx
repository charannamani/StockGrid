import { useEffect, useState } from "react";
import { Warehouse, Plus, Pencil, PowerOff, X } from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const emptyForm = { name: "", address: "", capacity: "" };

const Warehouses = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchWarehouses = async () => {
    try {
      const res = await API.get("/warehouses");
      setWarehouses(res.data || []);
    } catch (err) {
      toast.error("Couldn't load warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (w) => {
    setEditingId(w._id);
    setForm({ name: w.name, address: w.address || "", capacity: w.capacity ?? "" });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        address: form.address,
        capacity: form.capacity === "" ? undefined : Number(form.capacity),
      };

      if (editingId) {
        await API.put(`/warehouses/${editingId}`, payload);
        toast.success("Warehouse updated");
      } else {
        await API.post("/warehouses", payload);
        toast.success("Warehouse created");
      }

      closeForm();
      fetchWarehouses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm("Deactivate this warehouse?")) return;
    try {
      await API.delete(`/warehouses/${id}`);
      toast.success("Warehouse deactivated");
      fetchWarehouses();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    }
  };

  if (loading) return <div style={styles.loadingText}>Loading warehouses...</div>;

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Warehouses</h1>
          <p style={styles.subtitle}>{warehouses.length} active location{warehouses.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button style={styles.primaryBtn} onClick={openCreate}>
            <Plus size={16} />
            <span>Add Warehouse</span>
          </button>
        )}
      </div>

      {warehouses.length === 0 ? (
        <div style={styles.section}>
          <p style={styles.emptyText}>No warehouses yet.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {warehouses.map((w) => (
            <div key={w._id} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.cardIcon}>
                  <Warehouse size={18} color="#fff" />
                </div>
                {isAdmin && (
                  <div style={styles.cardActions}>
                    <button style={styles.iconBtn} onClick={() => openEdit(w)} title="Edit">
                      <Pencil size={15} />
                    </button>
                    <button
                      style={styles.iconBtn}
                      onClick={() => handleDeactivate(w._id)}
                      title="Deactivate"
                    >
                      <PowerOff size={15} />
                    </button>
                  </div>
                )}
              </div>
              <div style={styles.cardName}>{w.name}</div>
              <div style={styles.cardAddress}>{w.address || "No address set"}</div>
              <div style={styles.cardCapacity}>
                {w.capacity != null ? `Capacity: ${w.capacity}` : "No capacity limit"}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={styles.overlay} onClick={closeForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingId ? "Edit Warehouse" : "New Warehouse"}</h2>
              <button style={styles.closeBtn} onClick={closeForm}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <label style={styles.label}>Name</label>
              <input
                style={styles.input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <label style={styles.label}>Address</label>
              <input
                style={styles.input}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />

              <label style={styles.label}>Capacity</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />

              <button style={styles.submitBtn} type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Save Changes" : "Create Warehouse"}
              </button>
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
    marginBottom: "24px",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "16px",
  },
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "18px",
    border: "1px solid #e5e7eb",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  cardIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "9px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  cardActions: { display: "flex", gap: "6px" },
  iconBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  cardName: { fontSize: "15px", fontWeight: 700, color: "#111827" },
  cardAddress: { fontSize: "13px", color: "#64748b", marginTop: "4px" },
  cardCapacity: { fontSize: "12px", color: "#94a3b8", marginTop: "8px" },
  section: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  emptyText: { fontSize: "13px", color: "#94a3b8" },
  loadingText: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
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
    width: "380px",
    maxWidth: "90vw",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  modalTitle: { fontSize: "16px", fontWeight: 700, color: "#111827", margin: 0 },
  closeBtn: {
    border: "none",
    background: "transparent",
    color: "#94a3b8",
    cursor: "pointer",
  },
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
  submitBtn: {
    width: "100%",
    marginTop: "20px",
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

export default Warehouses;