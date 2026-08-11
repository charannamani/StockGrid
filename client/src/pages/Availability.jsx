import { useEffect, useState } from "react";
import { Search, CheckCircle2, XCircle, Warehouse } from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const Availability = () => {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await API.get("/products");
        setProducts(res.data || []);
      } catch (err) {
        toast.error("Couldn't load products");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!productId || !quantity) return;

    setChecking(true);
    setResult(null);
    try {
      const res = await API.get("/stock/availability", {
        params: { productId, quantity },
      });
      setResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't check availability");
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <div style={styles.loadingText}>Loading products...</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Availability</h1>
        <p style={styles.subtitle}>Check if an order can be fulfilled, and from where.</p>
      </div>

      <div style={styles.searchCard}>
        <form onSubmit={handleCheck} style={styles.searchForm}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Product</label>
            <select
              style={styles.input}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          </div>
          <div style={styles.fieldGroupSmall}>
            <label style={styles.label}>Quantity</label>
            <input
              style={styles.input}
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <button style={styles.checkBtn} type="submit" disabled={checking}>
            <Search size={16} />
            <span>{checking ? "Checking..." : "Check"}</span>
          </button>
        </form>
      </div>

      {result && (
        <div style={styles.resultCard}>
          <div style={styles.resultHeader}>
            {result.fulfillable ? (
              <>
                <CheckCircle2 size={22} color="#16a34a" />
                <div>
                  <div style={styles.resultTitleOk}>Fulfillable</div>
                  <div style={styles.resultSubtitle}>
                    {result.strategy === "single_warehouse"
                      ? "Can be fulfilled from a single warehouse"
                      : "Requires combining stock from multiple warehouses"}
                  </div>
                </div>
              </>
            ) : (
              <>
                <XCircle size={22} color="#dc2626" />
                <div>
                  <div style={styles.resultTitleFail}>Not Fulfillable</div>
                  <div style={styles.resultSubtitle}>
                    Short by {result.shortfall} unit{result.shortfall !== 1 ? "s" : ""} —{" "}
                    {result.totalAvailable} available total
                  </div>
                </div>
              </>
            )}
          </div>

          {result.options?.length > 0 && (
            <div style={styles.optionsList}>
              {result.options.map((opt, i) => (
                <div key={i} style={styles.optionRow}>
                  <div style={styles.optionWarehouse}>
                    <Warehouse size={15} color="#94a3b8" />
                    <span>{opt.warehouse?.name || "—"}</span>
                  </div>
                  <div style={styles.optionQty}>
                    {opt.quantityToUse != null
                      ? `Use ${opt.quantityToUse} of ${opt.quantityAvailable}`
                      : `${opt.quantityAvailable} available`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  header: { marginBottom: "20px" },
  title: { fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "4px" },
  searchCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e5e7eb",
    marginBottom: "20px",
  },
  searchForm: { display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" },
  fieldGroup: { flex: 2, minWidth: "200px" },
  fieldGroupSmall: { flex: 1, minWidth: "100px" },
  label: { display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  checkBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    height: "41px",
  },
  resultCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  resultHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" },
  resultTitleOk: { fontSize: "15px", fontWeight: 700, color: "#16a34a" },
  resultTitleFail: { fontSize: "15px", fontWeight: 700, color: "#dc2626" },
  resultSubtitle: { fontSize: "13px", color: "#64748b", marginTop: "2px" },
  optionsList: { display: "flex", flexDirection: "column", gap: "8px" },
  optionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    background: "#f8fafc",
    borderRadius: "8px",
    fontSize: "13px",
  },
  optionWarehouse: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#111827" },
  optionQty: { color: "#64748b" },
  loadingText: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
};

export default Availability;