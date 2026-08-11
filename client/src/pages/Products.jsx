import { useEffect, useState } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  Tag,
  DollarSign,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const emptyForm = { name: "", sku: "", category: "", unitCost: "", description: "" };

const Products = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchProducts = async (searchTerm = "") => {
    try {
      const res = await API.get("/products", {
        params: searchTerm ? { search: searchTerm } : {},
      });
      setProducts(res.data || []);
    } catch (err) {
      toast.error("Couldn't load product catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => fetchProducts(search), 350);
    return () => clearTimeout(delay);
  }, [search]);

  const categories = ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];

  const filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditingId(p._id);
    setForm({
      name: p.name,
      sku: p.sku,
      category: p.category,
      unitCost: p.unitCost,
      description: p.description || "",
    });
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
        sku: form.sku.trim().toUpperCase(),
        category: form.category.trim(),
        unitCost: Number(form.unitCost),
        description: form.description,
      };

      if (editingId) {
        const { sku, ...updatePayload } = payload;
        await API.put(`/products/${editingId}`, updatePayload);
        toast.success("Product updated successfully");
      } else {
        await API.post("/products", payload);
        toast.success("Product created successfully");
      }

      closeForm();
      fetchProducts(search);
    } catch (err) {
      toast.error(err.response?.data?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Permanently delete this product? This action cannot be undone.")) return;
    try {
      await API.delete(`/products/${id}`);
      toast.success("Product removed");
      fetchProducts(search);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete product");
    }
  };

  return (
    <div style={styles.container}>
      {/* Page Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Product Catalog</h1>
          <p style={styles.subtitle}>
            Manage global product SKUs and unit valuation across all warehouses.
          </p>
        </div>
        {isAdmin && (
          <button style={styles.primaryBtn} onClick={openCreate}>
            <Plus size={16} />
            <span>Register Product</span>
          </button>
        )}
      </div>

      {/* Control Bar: Search & Category Filter */}
      <div style={styles.controlBar}>
        <div style={styles.searchWrapper}>
          <Search size={16} color="#94a3b8" />
          <input
            style={styles.searchInput}
            placeholder="Search SKUs or product names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={styles.filterGroup}>
          <SlidersHorizontal size={14} color="#64748b" />
          <span style={styles.filterLabel}>Category:</span>
          <select
            style={styles.categorySelect}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "all" ? "All Categories" : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div style={styles.tableCard}>
        {loading ? (
          <div style={styles.emptyState}>Loading catalog data...</div>
        ) : filteredProducts.length === 0 ? (
          <div style={styles.emptyState}>
            <Package size={32} color="#94a3b8" />
            <p style={styles.emptyText}>No matching products found in catalog.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <div style={styles.tableHeaderRow}>
              <span>PRODUCT DETAILS</span>
              <span>SKU</span>
              <span>CATEGORY</span>
              <span style={{ textAlign: "right" }}>UNIT COST</span>
              {isAdmin && <span style={{ textAlign: "right" }}>ACTIONS</span>}
            </div>

            {filteredProducts.map((p) => (
              <div key={p._id} style={styles.tableRow}>
                <div style={styles.productCell}>
                  <div style={styles.iconBox}>
                    <Package size={16} color="#ea580c" />
                  </div>
                  <div>
                    <div style={styles.productName}>{p.name}</div>
                    {p.description && (
                      <div style={styles.productDesc}>{p.description}</div>
                    )}
                  </div>
                </div>

                <div>
                  <span style={styles.skuBadge}>{p.sku}</span>
                </div>

                <div>
                  <span style={styles.categoryTag}>
                    <Tag size={10} style={{ marginRight: "4px" }} />
                    {p.category}
                  </span>
                </div>

                <div style={styles.costCell}>
                  ${Number(p.unitCost).toFixed(2)}
                </div>

                {isAdmin && (
                  <div style={styles.rowActions}>
                    <button
                      style={styles.iconBtn}
                      onClick={() => openEdit(p)}
                      title="Edit Product"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      style={styles.deleteIconBtn}
                      onClick={() => handleDelete(p._id)}
                      title="Delete Product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal Drawer */}
      {showForm && (
        <div style={styles.overlay} onClick={closeForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingId ? "Edit Product Details" : "Register New Product"}
                </h2>
                <p style={styles.modalSubtitle}>
                  {editingId
                    ? "Update pricing, category, and metadata."
                    : "Add a new SKU to global warehouse tracking."}
                </p>
              </div>
              <button style={styles.closeBtn} onClick={closeForm}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div>
                <label style={styles.label}>Product Name</label>
                <input
                  style={styles.input}
                  placeholder="e.g., Ergonomic Mechanical Keyboard"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div style={styles.formRow}>
                <div>
                  <label style={styles.label}>SKU Code</label>
                  <input
                    style={{
                      ...styles.input,
                      ...(editingId ? styles.disabledInput : {}),
                    }}
                    placeholder="KEY-KB-001"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    required
                    disabled={!!editingId}
                  />
                </div>

                <div>
                  <label style={styles.label}>Category</label>
                  <input
                    style={styles.input}
                    placeholder="Electronics"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={styles.label}>Unit Cost ($)</label>
                <input
                  style={styles.input}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="49.99"
                  value={form.unitCost}
                  onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={styles.label}>Description (Optional)</label>
                <textarea
                  style={{ ...styles.input, resize: "vertical", minHeight: "80px" }}
                  placeholder="Brief operational specifications..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div style={styles.modalFooter}>
                <button
                  style={styles.cancelBtn}
                  type="button"
                  onClick={closeForm}
                >
                  Cancel
                </button>
                <button
                  style={styles.submitBtn}
                  type="submit"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Save Changes"
                    : "Create SKU"}
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
  container: { maxWidth: "1280px", margin: "0 auto" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: { fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 },
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
    boxShadow: "0 2px 8px rgba(239, 68, 68, 0.25)",
  },
  controlBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },
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
  filterGroup: { display: "flex", alignItems: "center", gap: "8px" },
  filterLabel: { fontSize: "13px", fontWeight: 600, color: "#475569" },
  categorySelect: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    background: "#fff",
    color: "#0f172a",
    outline: "none",
  },
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
    gridTemplateColumns: "2.5fr 1.2fr 1.2fr 1fr 1fr",
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
    gridTemplateColumns: "2.5fr 1.2fr 1.2fr 1fr 1fr",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
  },
  productCell: { display: "flex", alignItems: "center", gap: "12px" },
  iconBox: {
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    background: "#fff7ed",
    border: "1px solid #ffedd5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  productName: { fontWeight: 600, color: "#0f172a" },
  productDesc: { fontSize: "11px", color: "#94a3b8", marginTop: "2px" },
  skuBadge: {
    fontFamily: "monospace",
    fontWeight: 600,
    fontSize: "12px",
    background: "#f1f5f9",
    color: "#334155",
    padding: "3px 8px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
  },
  categoryTag: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "12px",
    color: "#475569",
    background: "#f8fafc",
    padding: "3px 10px",
    borderRadius: "999px",
    border: "1px solid #e2e8f0",
  },
  costCell: { fontWeight: 700, color: "#0f172a", textAlign: "right" },
  rowActions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  iconBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  deleteIconBtn: {
    width: "30px",
    height: "30px",
    borderRadius: "6px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  emptyState: { padding: "48px", textAlign: "center", color: "#94a3b8" },
  emptyText: { marginTop: "10px", fontSize: "14px" },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px",
    width: "440px",
    maxWidth: "92vw",
    boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
  },
  modalHeader: { display: "flex", justifyContent: "space-between", marginBottom: "20px" },
  modalTitle: { fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 },
  modalSubtitle: { fontSize: "12px", color: "#64748b", marginTop: "4px" },
  closeBtn: { border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: "14px" },
  formRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  label: { display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  disabledInput: { background: "#f8fafc", color: "#94a3b8" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" },
  cancelBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#475569",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
  },
};

export default Products;