import { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  X,
  Webhook,
  ShieldCheck,
} from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const ApiKeys = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await API.get("/apikeys");
      setKeys(res.data || []);
    } catch (err) {
      toast.error("Couldn't load registered API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await API.post("/apikeys", {
        name: keyName,
        callbackUrl: callbackUrl || undefined,
      });
      setGeneratedResult(res.data);
      setShowModal(false);
      setKeyName("");
      setCallbackUrl("");
      fetchKeys();
      toast.success("API key generated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not generate key");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm("Revoke this API key permanently? Active client integrations will fail.")) return;
    try {
      await API.delete(`/apikeys/${id}`);
      toast.success("API key revoked");
      fetchKeys();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not revoke key");
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return <div style={styles.loadingState}>Loading API key registries...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>API Access & Webhook Hub</h1>
          <p style={styles.subtitle}>
            Manage external client credentials and automated webhook subscribers with HMAC-SHA256 verification.
          </p>
        </div>
        <button style={styles.primaryBtn} onClick={() => setShowModal(true)}>
          <Plus size={16} />
          <span>Generate API Key</span>
        </button>
      </div>

      {generatedResult && (
        <div style={styles.secretBanner}>
          <div style={styles.secretBannerHeader}>
            <div style={styles.secretHeaderGroup}>
              <ShieldCheck size={20} color="#16a34a" />
              <span style={styles.secretTitle}>API Credentials Generated</span>
            </div>
            <button
              style={styles.closeBannerBtn}
              onClick={() => setGeneratedResult(null)}
            >
              <X size={16} />
            </button>
          </div>
          <p style={styles.secretSubtext}>
            Save your secret key now. For security purposes, it will never be displayed again.
          </p>

          <div style={styles.tokenGrid}>
            <div>
              <div style={styles.tokenLabel}>API Key (Client Token)</div>
              <div style={styles.tokenBox}>
                <span style={styles.tokenText}>{generatedResult.key}</span>
                <button
                  style={styles.copyBtn}
                  onClick={() => copyToClipboard(generatedResult.key, "key")}
                >
                  {copiedKey ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div>
              <div style={styles.tokenLabel}>HMAC Webhook Secret</div>
              <div style={styles.tokenBox}>
                <span style={styles.tokenText}>{generatedResult.keySecret}</span>
                <button
                  style={styles.copyBtn}
                  onClick={() => copyToClipboard(generatedResult.keySecret, "secret")}
                >
                  {copiedSecret ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.tableCard}>
        {keys.length === 0 ? (
          <div style={styles.emptyState}>
            <KeyRound size={32} color="#94a3b8" />
            <p style={styles.emptyText}>No active API keys created.</p>
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <div style={styles.tableHeaderRow}>
              <span>NAME / CLIENT</span>
              <span>KEY IDENTIFIER</span>
              <span>WEBHOOK CALLBACK URL</span>
              <span>GENERATED BY</span>
              <span style={{ textAlign: "right" }}>ACTIONS</span>
            </div>

            {keys.map((k) => (
              <div key={k._id} style={styles.tableRow}>
                <div style={styles.nameCell}>
                  <div style={styles.keyIcon}>
                    <KeyRound size={15} color="#ea580c" />
                  </div>
                  <div>
                    <span style={styles.clientName}>{k.name}</span>
                    <span style={styles.createdDate}>
                      {new Date(k.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div style={styles.keyCell}>
                  <span style={styles.keyBadge}>
                    {k.key ? `${k.key.substring(0, 8)}...${k.key.slice(-4)}` : "sg_live_••••"}
                  </span>
                </div>

                <div style={styles.webhookCell}>
                  {k.callbackUrl ? (
                    <span style={styles.webhookUrlActive}>
                      <Webhook size={12} style={{ marginRight: "6px" }} />
                      {k.callbackUrl}
                    </span>
                  ) : (
                    <span style={styles.webhookDisabled}>No Webhook Configured</span>
                  )}
                </div>

                <div style={styles.creatorCell}>
                  {k.createdBy?.name || "Administrator"}
                </div>

                <div style={{ textAlign: "right" }}>
                  <button
                    style={styles.revokeBtn}
                    onClick={() => handleRevoke(k._id)}
                    title="Revoke Key"
                  >
                    <Trash2 size={14} />
                    <span>Revoke</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={styles.overlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>Generate External API Key</h2>
                <p style={styles.modalSubtitle}>
                  Authorize external systems to place orders and subscribe to real-time threshold webhooks.
                </p>
              </div>
              <button style={styles.closeBtn} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateKey} style={styles.form}>
              <div>
                <label style={styles.label}>Application or Client Name</label>
                <input
                  style={styles.input}
                  placeholder="e.g. Shopify Storefront Live"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={styles.label}>Webhook Callback URL (Optional)</label>
                <input
                  style={styles.input}
                  type="url"
                  placeholder="https://client-store.com/api/webhooks/stock"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                />
                <span style={styles.helperText}>
                  StockGrid will dispatch signed <code>stock.low</code> and <code>stock.replenished</code> events to this URL.
                </span>
              </div>

              <div style={styles.modalFooter}>
                <button
                  style={styles.cancelBtn}
                  type="button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  style={styles.submitBtn}
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Generating..." : "Generate Key Pair"}
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
  },
  secretBanner: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "24px",
  },
  secretBannerHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  secretHeaderGroup: { display: "flex", alignItems: "center", gap: "8px" },
  secretTitle: { fontSize: "15px", fontWeight: 700, color: "#166534" },
  closeBannerBtn: { background: "transparent", border: "none", color: "#166534", cursor: "pointer" },
  secretSubtext: { fontSize: "13px", color: "#15803d", marginTop: "4px", marginBottom: "16px" },
  tokenGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
  tokenLabel: { fontSize: "11px", fontWeight: 700, color: "#166534", marginBottom: "4px" },
  tokenBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "#ffffff",
    border: "1px solid #86efac",
    borderRadius: "8px",
    padding: "8px 12px",
  },
  tokenText: { fontFamily: "monospace", fontSize: "13px", color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" },
  copyBtn: { background: "transparent", border: "none", color: "#64748b", cursor: "pointer" },
  tableCard: { background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden" },
  tableWrapper: { display: "flex", flexDirection: "column" },
  tableHeaderRow: {
    display: "grid",
    gridTemplateColumns: "1.8fr 1.4fr 2fr 1fr 0.8fr",
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
    gridTemplateColumns: "1.8fr 1.4fr 2fr 1fr 0.8fr",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid #f1f5f9",
    fontSize: "13px",
  },
  nameCell: { display: "flex", alignItems: "center", gap: "10px" },
  keyIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "#fff7ed",
    border: "1px solid #ffedd5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  clientName: { fontWeight: 600, color: "#0f172a", display: "block" },
  createdDate: { fontSize: "11px", color: "#94a3b8" },
  keyCell: { display: "flex" },
  keyBadge: {
    fontFamily: "monospace",
    fontSize: "12px",
    background: "#f1f5f9",
    color: "#334155",
    padding: "3px 8px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
  },
  webhookCell: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  webhookUrlActive: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "12px",
    color: "#2563eb",
    background: "#eff6ff",
    padding: "3px 8px",
    borderRadius: "6px",
    border: "1px solid #bfdbfe",
  },
  webhookDisabled: { fontSize: "12px", color: "#94a3b8" },
  creatorCell: { color: "#475569" },
  revokeBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
  },
  emptyState: { padding: "48px", textAlign: "center", color: "#94a3b8" },
  emptyText: { marginTop: "10px", fontSize: "14px" },
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: { background: "#fff", borderRadius: "16px", padding: "28px", width: "440px", maxWidth: "92vw" },
  modalHeader: { display: "flex", justifyContent: "space-between", marginBottom: "20px" },
  modalTitle: { fontSize: "18px", fontWeight: 700, color: "#0f172a", margin: 0 },
  modalSubtitle: { fontSize: "12px", color: "#64748b", marginTop: "4px" },
  closeBtn: { border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: "16px" },
  label: { display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #cbd5e1",
    fontSize: "13px",
    boxSizing: "border-box",
  },
  helperText: { display: "block", fontSize: "11px", color: "#64748b", marginTop: "4px" },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" },
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
  loadingState: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
};

export default ApiKeys;