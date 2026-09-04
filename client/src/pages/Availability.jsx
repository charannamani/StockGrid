import { useEffect, useState } from "react";
import { Search, CheckCircle2, XCircle, Warehouse, MapPin, Navigation, ChevronDown, ChevronUp } from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const PRESET_DESTINATIONS = [
  { label: "Hyderabad Central", lat: 17.3850, lng: 78.4867 },
  { label: "Cyberabad / Hitec City", lat: 17.4435, lng: 78.3772 },
  { label: "Bengaluru Hub", lat: 12.9716, lng: 77.5946 },
  { label: "Mumbai Port Zone", lat: 18.9438, lng: 72.8354 },
];

const Availability = () => {
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
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

  const handleSelectPreset = (preset) => {
    setDestLat(preset.lat);
    setDestLng(preset.lng);
    setLocationLabel(preset.label);
  };

  const handleDetectGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by browser");
      return;
    }
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDestLat(Number(pos.coords.latitude.toFixed(4)));
        setDestLng(Number(pos.coords.longitude.toFixed(4)));
        setLocationLabel("Current Device GPS");
        setDetectingGps(false);
        toast.success("Delivery destination set to current GPS!");
      },
      () => {
        setDetectingGps(false);
        toast.error("Could not retrieve current location");
      }
    );
  };

  const clearLocation = () => {
    setDestLat("");
    setDestLng("");
    setLocationLabel("");
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!productId || !quantity) return;

    setChecking(true);
    setResult(null);
    try {
      const params = { productId, quantity };
      if (destLat && destLng) {
        params.destLat = destLat;
        params.destLng = destLng;
      }
      const res = await API.get("/stock/availability", { params });
      setResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't check availability");
    } finally {
      setChecking(false);
    }
  };

  if (loading) return <div style={styles.loadingText}>Loading catalog...</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Fulfillment Availability Engine</h1>
        <p style={styles.subtitle}>Check order stock feasibility and route using Haversine distance calculations.</p>
      </div>

      <div style={styles.searchCard}>
        <form onSubmit={handleCheck}>
          <div style={styles.formTopRow}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Product SKU</label>
              <select
                style={styles.input}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                <option value="">Select product to fulfill</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                ))}
              </select>
            </div>

            <div style={styles.fieldGroupSmall}>
              <label style={styles.label}>Units Needed</label>
              <input
                style={styles.input}
                type="number"
                min="1"
                placeholder="Qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <button style={styles.checkBtn} type="submit" disabled={checking}>
              <Search size={16} />
              <span>{checking ? "Routing..." : "Check Availability"}</span>
            </button>
          </div>

          <div style={styles.locationSection}>
            <div style={styles.locationHeader}>
              <div style={styles.locationTitleGroup}>
                <MapPin size={14} color="#ea580c" />
                <span style={styles.locationTitle}>Delivery Destination:</span>
                <span style={styles.activeLocationText}>
                  {locationLabel ? `${locationLabel} (${destLat}, ${destLng})` : "No destination set (Fallback: Quantity-Greedy routing)"}
                </span>
                {locationLabel && (
                  <button type="button" style={styles.clearLocBtn} onClick={clearLocation}>
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                style={styles.gpsBtn}
                onClick={handleDetectGps}
                disabled={detectingGps}
              >
                <Navigation size={12} />
                <span>{detectingGps ? "Detecting..." : "Use Current GPS"}</span>
              </button>
            </div>

            <div style={styles.presetRow}>
              <span style={styles.presetLabel}>Quick Presets:</span>
              {PRESET_DESTINATIONS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  style={{
                    ...styles.presetChip,
                    ...(locationLabel === preset.label ? styles.presetChipActive : {}),
                  }}
                  onClick={() => handleSelectPreset(preset)}
                >
                  {preset.label}
                </button>
              ))}

              <button
                type="button"
                style={styles.toggleCoordsBtn}
                onClick={() => setShowManualCoords(!showManualCoords)}
              >
                <span>Manual GPS</span>
                {showManualCoords ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {showManualCoords && (
              <div style={styles.manualCoordInputs}>
                <input
                  style={styles.smallInput}
                  type="number"
                  step="any"
                  placeholder="Latitude (e.g. 17.3850)"
                  value={destLat}
                  onChange={(e) => {
                    setDestLat(e.target.value);
                    setLocationLabel("Manual Coordinate");
                  }}
                />
                <input
                  style={styles.smallInput}
                  type="number"
                  step="any"
                  placeholder="Longitude (e.g. 78.4867)"
                  value={destLng}
                  onChange={(e) => {
                    setDestLng(e.target.value);
                    setLocationLabel("Manual Coordinate");
                  }}
                />
              </div>
            )}
          </div>
        </form>
      </div>

      {result && (
        <div style={styles.resultCard}>
          <div style={styles.resultHeader}>
            {result.fulfillable ? (
              <>
                <CheckCircle2 size={22} color="#16a34a" />
                <div>
                  <div style={styles.resultTitleOk}>Order Fulfillable</div>
                  <div style={styles.resultSubtitle}>
                    Routing Strategy: <strong>{result.strategy.replace(/_/g, " ").toUpperCase()}</strong>
                  </div>
                </div>
              </>
            ) : (
              <>
                <XCircle size={22} color="#dc2626" />
                <div>
                  <div style={styles.resultTitleFail}>Insufficient Stock</div>
                  <div style={styles.resultSubtitle}>
                    Short by {result.shortfall} unit{result.shortfall !== 1 ? "s" : ""} —{" "}
                    {result.totalAvailable} units available across all active facilities
                  </div>
                </div>
              </>
            )}
          </div>

          {result.options?.length > 0 && (
            <div style={styles.optionsList}>
              {result.options.map((opt, i) => (
                <div key={i} style={styles.optionRow}>
                  <div>
                    <div style={styles.optionWarehouse}>
                      <Warehouse size={15} color="#94a3b8" />
                      <span>{opt.warehouse?.name || "—"}</span>
                    </div>
                    {opt.warehouse?.address && (
                      <div style={styles.optionAddress}>
                        <MapPin size={11} color="#64748b" />
                        <span>{opt.warehouse.address}</span>
                      </div>
                    )}
                  </div>

                  <div style={styles.optionDetails}>
                    {opt.distanceKm != null && (
                      <span style={styles.distanceBadge}>{opt.distanceKm} km from delivery point</span>
                    )}
                    <div style={styles.optionQty}>
                      {opt.quantityToUse != null
                        ? `Allocate: ${opt.quantityToUse} of ${opt.quantityAvailable} units`
                        : `${opt.quantityAvailable} units on hand`}
                    </div>
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
  formTopRow: { display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" },
  fieldGroup: { flex: 2, minWidth: "220px" },
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
  locationSection: {
    marginTop: "16px",
    paddingTop: "14px",
    borderTop: "1px dashed #e2e8f0",
  },
  locationHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
    marginBottom: "8px",
  },
  locationTitleGroup: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  locationTitle: { fontSize: "12px", fontWeight: 700, color: "#334155" },
  activeLocationText: { fontSize: "12px", color: "#64748b", fontWeight: 500 },
  clearLocBtn: {
    background: "transparent",
    border: "none",
    color: "#dc2626",
    fontSize: "11px",
    cursor: "pointer",
    textDecoration: "underline",
  },
  gpsBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    borderRadius: "6px",
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#ea580c",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  presetRow: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  presetLabel: { fontSize: "11px", color: "#94a3b8", marginRight: "2px" },
  presetChip: {
    padding: "4px 10px",
    borderRadius: "999px",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
  },
  presetChipActive: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#2563eb",
    fontWeight: 700,
  },
  toggleCoordsBtn: {
    display: "flex",
    alignItems: "center",
    gap: "3px",
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: "11px",
    cursor: "pointer",
    marginLeft: "auto",
  },
  manualCoordInputs: { display: "flex", gap: "8px", marginTop: "8px" },
  smallInput: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #cbd5e1",
    fontSize: "12px",
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
    padding: "12px 14px",
    background: "#f8fafc",
    borderRadius: "8px",
    fontSize: "13px",
  },
  optionWarehouse: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#111827" },
  optionAddress: { display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#64748b", marginTop: "3px" },
  optionDetails: { display: "flex", alignItems: "center", gap: "12px" },
  distanceBadge: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#0369a1",
    background: "#e0f2fe",
    padding: "3px 8px",
    borderRadius: "6px",
  },
  optionQty: { color: "#334155", fontWeight: 500 },
  loadingText: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
};

export default Availability;