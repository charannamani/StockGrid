import { useEffect, useState } from "react";
import { Warehouse, Plus, Pencil, PowerOff, X, MapPin, Navigation } from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const emptyForm = { name: "", address: "", capacity: "", latitude: "", longitude: "" };

const Warehouses = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);

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
    setForm({
      name: w.name,
      address: w.address || "",
      capacity: w.capacity ?? "",
      latitude: w.latitude ?? "",
      longitude: w.longitude ?? "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
        }));
        toast.success("Location coordinates auto-detected!");
        setDetectingLocation(false);
      },
      (err) => {
        toast.error("Couldn't detect location. Please enter manually.");
        setDetectingLocation(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        address: form.address,
        capacity: form.capacity === "" ? undefined : Number(form.capacity),
        latitude: form.latitude === "" ? undefined : Number(form.latitude),
        longitude: form.longitude === "" ? undefined : Number(form.longitude),
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
          <h1 style={styles.title}>Warehouses & Facilities</h1>
          <p style={styles.subtitle}>{warehouses.length} active physical distribution point{warehouses.length !== 1 ? "s" : ""}</p>
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
          <p style={styles.emptyText}>No warehouses configured.</p>
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
              <div style={styles.cardAddress}>Area / Address: {w.address || "Unspecified Area"}</div>
              <div style={styles.cardCapacity}>
                {w.capacity != null ? `Storage Capacity: ${w.capacity.toLocaleString()} units` : "Capacity: Unlimited"}
              </div>
              {w.latitude != null && w.longitude != null ? (
                <div style={styles.cardCoords}>
                  <MapPin size={11} />
                  GPS: {w.latitude.toFixed(4)}, {w.longitude.toFixed(4)}
                </div>
              ) : (
                <div style={styles.cardCoordsMissing}>
                  <MapPin size={11} />
                  No GPS coordinates set
                </div>
              )}
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
              <label style={styles.label}>Warehouse Facility Name</label>
              <input
                style={styles.input}
                placeholder="e.g. Hyderabad Central Depot"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <label style={styles.label}>Area / Address</label>
              <input
                style={styles.input}
                placeholder="e.g. Begumpet Industrial Zone, Hyderabad"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />

              <label style={styles.label}>Maximum Storage Capacity (Units)</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                placeholder="e.g. 10000"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />

              <div style={styles.coordHeader}>
                <label style={{ ...styles.label, margin: 0 }}>Coordinates (For Routing)</label>
                <button
                  type="button"
                  style={styles.detectBtn}
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                >
                  <Navigation size={12} />
                  <span>{detectingLocation ? "Detecting..." : "Auto-Detect My GPS"}</span>
                </button>
              </div>

              <div style={styles.coordRow}>
                <div style={styles.coordCol}>
                  <input
                    style={styles.input}
                    type="number"
                    step="any"
                    min="-90"
                    max="90"
                    placeholder="Latitude"
                    value={form.latitude}
                    onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  />
                </div>
                <div style={styles.coordCol}>
                  <input
                    style={styles.input}
                    type="number"
                    step="any"
                    min="-180"
                    max="180"
                    placeholder="Longitude"
                    value={form.longitude}
                    onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  />
                </div>
              </div>

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
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  title: { fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" },
  subtitle: { fontSize: "13px", color: "#64748b", marginTop: "4px" },
  primaryBtn: {
    display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", borderRadius: "9px",
    border: "none", background: "linear-gradient(135deg, #ef4444, #f59e0b)", color: "#fff",
    fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" },
  card: {
    background: "#fff", borderRadius: "14px", padding: "20px", border: "1px solid #e2e8f0",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)", transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" },
  cardIcon: {
    width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(239, 68, 68, 0.2)",
  },
  cardActions: { display: "flex", gap: "6px" },
  iconBtn: {
    width: "30px", height: "30px", borderRadius: "7px", border: "1px solid #e2e8f0",
    background: "#fff", color: "#64748b", display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer",
  },
  cardName: { fontSize: "16px", fontWeight: 700, color: "#0f172a" },
  cardAddress: { fontSize: "13px", color: "#64748b", marginTop: "4px" },
  cardCapacity: { fontSize: "12px", color: "#475569", marginTop: "10px", fontWeight: 500 },
  cardCoords: {
    display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#047857",
    background: "#ecfdf5", border: "1px solid #d1fae5", padding: "2px 8px", borderRadius: "6px",
    marginTop: "10px", fontWeight: 500,
  },
  cardCoordsMissing: {
    display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#94a3b8",
    background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 8px", borderRadius: "6px",
    marginTop: "10px",
  },
  section: { background: "#fff", borderRadius: "14px", padding: "32px", border: "1px solid #e2e8f0", textAlign: "center" },
  emptyText: { fontSize: "14px", color: "#94a3b8" },
  loadingText: { padding: "40px", color: "#94a3b8", fontSize: "14px", textAlign: "center" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(8px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
  },
  modal: {
    background: "#fff", borderRadius: "16px", padding: "26px", width: "420px", maxWidth: "90vw",
    boxShadow: "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" },
  modalTitle: { fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 },
  closeBtn: { border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", padding: "4px" },
  label: { display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px", marginTop: "14px" },
  coordHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", marginBottom: "6px" },
  detectBtn: {
    display: "flex", alignItems: "center", gap: "4px", background: "transparent", border: "none",
    color: "#ea580c", fontSize: "11px", fontWeight: 600, cursor: "pointer",
  },
  input: {
    width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db",
    fontSize: "13px", boxSizing: "border-box", color: "#0f172a", outline: "none",
  },
  coordRow: { display: "flex", gap: "10px" },
  coordCol: { flex: 1 },
  submitBtn: {
    width: "100%", marginTop: "22px", padding: "11px", borderRadius: "9px", border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)", color: "#fff", fontSize: "13px",
    fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.25)",
  },
};

export default Warehouses;