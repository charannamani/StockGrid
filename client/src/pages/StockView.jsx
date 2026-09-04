import { useEffect, useState } from "react";
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Warehouse,
  Search,
  MapPin,
  Navigation,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const PRESET_DESTINATIONS = [
  { label: "Hyderabad Central", lat: 17.3850, lng: 78.4867 },
  { label: "Cyberabad / Hitec City", lat: 17.4435, lng: 78.3772 },
  { label: "Bengaluru Hub", lat: 12.9716, lng: 77.5946 },
  { label: "Mumbai Port Zone", lat: 18.9438, lng: 72.8354 },
];

const StockView = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [stock, setStock] = useState([]);
  const [warehouseMeta, setWarehouseMeta] = useState({
    totalOccupancy: 0,
    capacity: null,
    spaceLeft: null,
    isOverCapacity: false,
  });
  const [search, setSearch] = useState("");
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [loadingStock, setLoadingStock] = useState(false);

  const [showRouter, setShowRouter] = useState(true);
  const [routeProduct, setRouteProduct] = useState("");
  const [routeQty, setRouteQty] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [checkingRoute, setCheckingRoute] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [routeResult, setRouteResult] = useState(null);

  useEffect(() => {
    const initData = async () => {
      try {
        const [whRes, prodRes] = await Promise.all([
          API.get("/warehouses"),
          API.get("/products"),
        ]);
        const list = whRes.data || [];
        setWarehouses(list);
        setProducts(prodRes.data || []);
        if (list.length > 0) setSelectedWarehouse(list[0]._id);
      } catch (err) {
        toast.error("Couldn't load network metadata");
      } finally {
        setLoadingWarehouses(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    if (!selectedWarehouse) return;

    const fetchStock = async () => {
      setLoadingStock(true);
      try {
        const res = await API.get(`/stock/warehouse/${selectedWarehouse}`);
        setStock(res.data.stock || []);
        setWarehouseMeta({
          totalOccupancy: res.data.totalOccupancy || 0,
          capacity: res.data.capacity,
          spaceLeft: res.data.spaceLeft,
          isOverCapacity: res.data.isOverCapacity,
        });
      } catch (err) {
        toast.error("Couldn't load facility inventory");
      } finally {
        setLoadingStock(false);
      }
    };
    fetchStock();
  }, [selectedWarehouse]);

  const activeWarehouseObj = warehouses.find((w) => w._id === selectedWarehouse);

  const filteredStock = stock.filter(
    (entry) =>
      entry.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
      entry.product?.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const lowStockCount = stock.filter(
    (entry) => entry.currentQuantity <= entry.lowStockThreshold
  ).length;

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
        toast.success("Destination pinned to current GPS coordinates!");
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

  const handleRouteCheck = async (e) => {
    e.preventDefault();
    if (!routeProduct || !routeQty) return;

    setCheckingRoute(true);
    setRouteResult(null);
    try {
      const params = { productId: routeProduct, quantity: routeQty };
      if (destLat && destLng) {
        params.destLat = destLat;
        params.destLng = destLng;
      }
      const res = await API.get("/stock/availability", { params });
      setRouteResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Routing simulation failed");
    } finally {
      setCheckingRoute(false);
    }
  };

  if (loadingWarehouses) {
    return <div style={styles.loadingState}>Connecting to inventory grid...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Stock Command & Fulfillment Center</h1>
          <p style={styles.subtitle}>
            Order dispatch simulator, multi-warehouse Haversine routing, and live physical facility ledgers.
          </p>
        </div>
      </div>

      <div style={styles.routerCard}>
        <div style={styles.routerHeader} onClick={() => setShowRouter(!showRouter)}>
          <div style={styles.routerTitleGroup}>
            <Search size={16} color="#ea580c" />
            <span style={styles.routerTitle}>Smart Availability & Haversine Distance Router</span>
            <span style={styles.routerBadge}>Multi-Node Optimizer</span>
          </div>
          <button type="button" style={styles.expandBtn}>
            {showRouter ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showRouter && (
          <div style={styles.routerBody}>
            <form onSubmit={handleRouteCheck}>
              <div style={styles.formTopRow}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Product SKU to Dispatch</label>
                  <select
                    style={styles.input}
                    value={routeProduct}
                    onChange={(e) => setRouteProduct(e.target.value)}
                    required
                  >
                    <option value="">Select product catalog SKU</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                    ))}
                  </select>
                </div>

                <div style={styles.fieldGroupSmall}>
                  <label style={styles.label}>Units Requested</label>
                  <input
                    style={styles.input}
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={routeQty}
                    onChange={(e) => setRouteQty(e.target.value)}
                    required
                  />
                </div>

                <button style={styles.checkBtn} type="submit" disabled={checkingRoute}>
                  <Search size={15} />
                  <span>{checkingRoute ? "Calculating..." : "Compute Route"}</span>
                </button>
              </div>

              <div style={styles.locationSection}>
                <div style={styles.locationHeader}>
                  <div style={styles.locationTitleGroup}>
                    <MapPin size={13} color="#ea580c" />
                    <span style={styles.locationTitle}>Destination Coordinate:</span>
                    <span style={styles.activeLocationText}>
                      {locationLabel ? `${locationLabel} (${destLat}, ${destLng})` : "No delivery location set (Using Quantity-Greedy allocation)"}
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
                    <span>{detectingGps ? "Acquiring..." : "Auto-Detect My GPS"}</span>
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
                    <span>Manual Lat/Lng</span>
                    {showManualCoords ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
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

            {routeResult && (
              <div style={styles.resultBox}>
                <div style={styles.resultHeader}>
                  {routeResult.fulfillable ? (
                    <>
                      <CheckCircle2 size={18} color="#16a34a" />
                      <div>
                        <span style={styles.resultTitleOk}>Order Allocation Fulfillable</span>
                        <span style={styles.strategyText}>
                          Routing Algorithm: <strong>{routeResult.strategy.replace(/_/g, " ").toUpperCase()}</strong>
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle size={18} color="#dc2626" />
                      <div>
                        <span style={styles.resultTitleFail}>Insufficient Network Stock</span>
                        <span style={styles.strategyText}>
                          Short by {routeResult.shortfall} units across all nodes ({routeResult.totalAvailable} units available total)
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {routeResult.options?.length > 0 && (
                  <div style={styles.optionsList}>
                    {routeResult.options.map((opt, i) => (
                      <div key={i} style={styles.optionRow}>
                        <div>
                          <span style={styles.optionName}>{opt.warehouse?.name}</span>
                          <span style={styles.optionAddr}>{opt.warehouse?.address || "No designated area recorded"}</span>
                        </div>
                        <div style={styles.optionMeta}>
                          {opt.distanceKm != null && (
                            <span style={styles.distBadge}>{opt.distanceKm} km from customer</span>
                          )}
                          <span style={styles.allocText}>
                            {opt.quantityToUse != null ? `Allocate: ${opt.quantityToUse} / ${opt.quantityAvailable} units` : `${opt.quantityAvailable} on hand`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={styles.sectionDivider}>
        <div style={styles.sectionDividerLine} />
        <span style={styles.sectionDividerText}>FACILITY INVENTORY INSPECTOR</span>
        <div style={styles.sectionDividerLine} />
      </div>

      <div style={styles.facilityControlsRow}>
        <div style={styles.facilitySelectContainer}>
          <Warehouse size={18} color="#ea580c" />
          <div style={{ flex: 1 }}>
            <div style={styles.controlMicroLabel}>Active Facility Location</div>
            <select
              style={styles.facilityDropdown}
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} — {w.address || "Main Distribution Hub"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.searchWrapper}>
          <Search size={16} color="#94a3b8" />
          <input
            style={styles.searchInput}
            placeholder="Search facility items by SKU or Name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={styles.summaryBar}>
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Facility & Region</span>
          <span style={styles.summaryValue}>{activeWarehouseObj?.name || "—"}</span>
          <span style={styles.summarySub}>{activeWarehouseObj?.address || "Unspecified Area"}</span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Physical Units Stored / Capacity</span>
          <span style={styles.summaryValue}>
            {warehouseMeta.totalOccupancy.toLocaleString()}
            {warehouseMeta.capacity != null ? ` / ${warehouseMeta.capacity.toLocaleString()}` : " (No Limit)"}
          </span>
          <span
            style={{
              ...styles.summarySub,
              color: warehouseMeta.isOverCapacity ? "#dc2626" : "#16a34a",
              fontWeight: 600,
            }}
          >
            {warehouseMeta.capacity == null
              ? "Unlimited Facility Volume"
              : warehouseMeta.isOverCapacity
              ? `Capacity exceeded by ${Math.abs(warehouseMeta.spaceLeft)} units`
              : `${warehouseMeta.spaceLeft} units space available`}
          </span>
        </div>
        <div style={styles.divider} />
        <div style={styles.summaryItem}>
          <span style={styles.summaryLabel}>Reorder Alert Warnings</span>
          <span
            style={{
              ...styles.summaryValue,
              color: lowStockCount > 0 ? "#dc2626" : "#16a34a",
            }}
          >
            {lowStockCount} items below threshold
          </span>
        </div>
      </div>

      <div style={styles.tableCard}>
        {loadingStock ? (
          <div style={styles.emptyState}>Syncing live inventory data...</div>
        ) : filteredStock.length === 0 ? (
          <div style={styles.emptyState}>
            <Boxes size={32} color="#94a3b8" />
            <p style={styles.emptyText}>No registered stock entries at this facility.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <div style={styles.tableHeaderRow}>
              <span>PRODUCT / SKU</span>
              <span>CATEGORY</span>
              <span style={{ textAlign: "right" }}>ON-HAND QTY</span>
              <span>SAFETY THRESHOLD</span>
              <span style={{ textAlign: "right" }}>FACILITY STATUS</span>
            </div>

            {filteredStock.map((entry) => {
              const isLow = entry.currentQuantity <= entry.lowStockThreshold;
              const thresholdRatio = Math.min(
                100,
                Math.round((entry.currentQuantity / (entry.lowStockThreshold * 2 || 20)) * 100)
              );

              return (
                <div key={entry._id} style={styles.tableRow}>
                  <div style={styles.productCell}>
                    <span style={styles.productName}>{entry.product?.name || "—"}</span>
                    <span style={styles.productSku}>{entry.product?.sku || "SKU-UNKNOWN"}</span>
                  </div>

                  <div style={styles.categoryCell}>
                    {entry.product?.category || "—"}
                  </div>

                  <div style={styles.qtyCell}>{entry.currentQuantity}</div>

                  <div style={styles.thresholdCell}>
                    <div style={styles.thresholdMeta}>
                      <span>{entry.currentQuantity} / {entry.lowStockThreshold} Min</span>
                    </div>
                    <div style={styles.progressTrack}>
                      <div
                        style={{
                          ...styles.progressFill,
                          width: `${thresholdRatio}%`,
                          background: isLow ? "#dc2626" : "#16a34a",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    {isLow ? (
                      <span style={styles.badgeLow}>
                        <AlertTriangle size={12} style={{ marginRight: "4px" }} />
                        Low Stock Alert
                      </span>
                    ) : (
                      <span style={styles.badgeOk}>
                        <CheckCircle2 size={12} style={{ marginRight: "4px" }} />
                        Optimal Level
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: { maxWidth: "1280px", margin: "0 auto" },
  header: {
    marginBottom: "20px",
  },
  title: { fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 },
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "4px" },
  routerCard: {
    background: "#ffffff",
    borderRadius: "14px",
    border: "1px solid #fed7aa",
    marginBottom: "24px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
  },
  routerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    background: "#fff7ed",
    cursor: "pointer",
  },
  routerTitleGroup: { display: "flex", alignItems: "center", gap: "8px" },
  routerTitle: { fontSize: "14px", fontWeight: 700, color: "#9a3412" },
  routerBadge: {
    fontSize: "10px",
    fontWeight: 700,
    background: "#ffedd5",
    color: "#ea580c",
    padding: "2px 6px",
    borderRadius: "4px",
  },
  expandBtn: { background: "transparent", border: "none", color: "#ea580c", cursor: "pointer" },
  routerBody: { padding: "18px", background: "#ffffff", borderTop: "1px solid #fed7aa" },
  formTopRow: { display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" },
  fieldGroup: { flex: 2, minWidth: "200px" },
  fieldGroupSmall: { flex: 1, minWidth: "100px" },
  label: { display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  checkBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "9px 16px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    height: "38px",
  },
  locationSection: {
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px dashed #f1f5f9",
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
  locationTitle: { fontSize: "11px", fontWeight: 700, color: "#334155" },
  activeLocationText: { fontSize: "11px", color: "#64748b" },
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
    gap: "4px",
    padding: "3px 8px",
    borderRadius: "6px",
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#ea580c",
    fontSize: "10px",
    fontWeight: 600,
    cursor: "pointer",
  },
  presetRow: { display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" },
  presetLabel: { fontSize: "11px", color: "#94a3b8" },
  presetChip: {
    padding: "3px 8px",
    borderRadius: "999px",
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    fontSize: "11px",
    cursor: "pointer",
  },
  presetChipActive: { background: "#eff6ff", borderColor: "#bfdbfe", color: "#2563eb", fontWeight: 700 },
  toggleCoordsBtn: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    background: "transparent",
    border: "none",
    color: "#64748b",
    fontSize: "11px",
    cursor: "pointer",
    marginLeft: "auto",
  },
  manualCoordInputs: { display: "flex", gap: "8px", marginTop: "8px" },
  smallInput: { flex: 1, padding: "5px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "11px" },
  resultBox: { marginTop: "14px", padding: "14px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" },
  resultHeader: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" },
  resultTitleOk: { fontSize: "13px", fontWeight: 700, color: "#16a34a", marginRight: "8px" },
  resultTitleFail: { fontSize: "13px", fontWeight: 700, color: "#dc2626", marginRight: "8px" },
  strategyText: { fontSize: "11px", color: "#64748b" },
  optionsList: { display: "flex", flexDirection: "column", gap: "6px" },
  optionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    background: "#ffffff",
    borderRadius: "6px",
    border: "1px solid #f1f5f9",
    fontSize: "12px",
  },
  optionName: { fontWeight: 600, color: "#0f172a", display: "block" },
  optionAddr: { fontSize: "10px", color: "#94a3b8" },
  optionMeta: { display: "flex", alignItems: "center", gap: "8px" },
  distBadge: { fontSize: "10px", fontWeight: 600, color: "#0369a1", background: "#e0f2fe", padding: "2px 6px", borderRadius: "4px" },
  allocText: { color: "#334155", fontWeight: 500 },
  sectionDivider: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    margin: "24px 0 16px",
  },
  sectionDividerLine: { flex: 1, height: "1px", background: "#e2e8f0" },
  sectionDividerText: { fontSize: "11px", fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em" },
  facilityControlsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "16px",
    flexWrap: "wrap",
  },
  facilitySelectContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "#fff",
    border: "1px solid #cbd5e1",
    borderRadius: "10px",
    padding: "8px 14px",
    minWidth: "320px",
  },
  controlMicroLabel: { fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" },
  facilityDropdown: {
    border: "none",
    outline: "none",
    fontSize: "13px",
    fontWeight: 700,
    color: "#0f172a",
    background: "transparent",
    width: "100%",
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
  summaryBar: {
    display: "flex",
    alignItems: "center",
    gap: "24px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "16px 24px",
    marginBottom: "20px",
  },
  summaryItem: { display: "flex", flexDirection: "column", gap: "2px" },
  summaryLabel: { fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.04em" },
  summaryValue: { fontSize: "18px", fontWeight: 800, color: "#0f172a" },
  summarySub: { fontSize: "11px", color: "#64748b" },
  divider: { width: "1px", height: "32px", background: "#e2e8f0" },
  tableCard: { background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden" },
  tableWrapper: { display: "flex", flexDirection: "column" },
  tableHeaderRow: {
    display: "grid",
    gridTemplateColumns: "2.5fr 1.2fr 1fr 1.8fr 1.5fr",
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
    gridTemplateColumns: "2.5fr 1.2fr 1fr 1.8fr 1.5fr",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
  },
  productCell: { display: "flex", flexDirection: "column" },
  productName: { fontWeight: 600, color: "#0f172a" },
  productSku: { fontSize: "11px", fontFamily: "monospace", color: "#64748b", marginTop: "2px" },
  categoryCell: { color: "#475569" },
  qtyCell: { fontWeight: 800, fontSize: "15px", color: "#0f172a", textAlign: "right" },
  thresholdCell: { paddingRight: "16px" },
  thresholdMeta: { fontSize: "11px", color: "#64748b", marginBottom: "4px" },
  progressTrack: { width: "100%", height: "6px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: "999px", transition: "width 0.3s ease" },
  badgeOk: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "6px",
    background: "#f0fdf4",
    color: "#16a34a",
    border: "1px solid #bbf7d0",
    display: "inline-flex",
    alignItems: "center",
  },
  badgeLow: {
    fontSize: "11px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "6px",
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    display: "inline-flex",
    alignItems: "center",
  },
  emptyState: { padding: "48px", textAlign: "center", color: "#94a3b8" },
  emptyText: { marginTop: "10px", fontSize: "14px" },
  loadingState: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
};

export default StockView;