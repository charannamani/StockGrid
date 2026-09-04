import { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, X, Copy, Check } from "lucide-react";
import API from "../utils/api";
import toast from "react-hot-toast";

const ApiKeys = () => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [newRawKey, setNewRawKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await API.get("/apikeys");
      setKeys(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't load API keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const openCreate = () => {
    setName("");
    setCallbackUrl("");
    setNewRawKey(null);
    setCopied(false);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setName("");
    setCallbackUrl("");
    setNewRawKey(null);
    setCopied(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await API.post("/apikeys", { name, callbackUrl: callbackUrl || undefined });
      setNewRawKey(res.data.rawKey);
      fetchKeys();
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't generate API key");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm("Revoke this API key? Anything using it will stop working immediately.")) return;
    try {
      await API.delete(`/apikeys/${id}`);
      toast.success("API key revoked");
      fetchKeys();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the key manually");
    }
  };

  if (loading) return <div style={styles.loadingText}>Loading API keys...</div>;

  return (
    <div>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>API Keys</h1>
          <p style={styles.subtitle}>
            {keys.length} key{keys.length !== 1 ? "s" : ""} — for external systems (e.g. an e-commerce
            platform) to connect to StockGrid
          </p>
        </div>
        <button style={styles.primaryBtn} onClick={openCreate}>
          <Plus size={16} />
          <span>Generate Key</span>
        </button>
      </div>

      {keys.length === 0 ? (
        <div style={styles.section}>
          <p style={styles.emptyText}>No API keys yet. Generate one to let an external system connect.</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Callback URL</th>
                <th style={styles.th}>Created By</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Created</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k._id}>
                  <td style={styles.td}>
                    <div style={styles.keyName}>
                      <KeyRound size={14} color="#94a3b8" />
                      {k.name}
                    </div>
                  </td>
                  <td style={styles.td}>
                    {k.callbackUrl ? (
                      <span style={styles.callbackText}>{k.callbackUrl}</span>
                    ) : (
                      <span style={styles.emptyText}>—</span>
                    )}
                  </td>
                  <td style={styles.td}>{k.createdBy?.name || "—"}</td>
                  <td style={styles.td}>
                    <span style={k.isActive ? styles.badgeActive : styles.badgeRevoked}>
                      {k.isActive ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td style={styles.td}>{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td style={styles.td}>
                    {k.isActive && (
                      <button
                        style={styles.iconBtn}
                        onClick={() => handleRevoke(k._id)}
                        title="Revoke"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div style={styles.overlay} onClick={closeForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {newRawKey ? "Key Generated" : "New API Key"}
              </h2>
              <button style={styles.closeBtn} onClick={closeForm}>
                <X size={18} />
              </button>
            </div>

            {!newRawKey ? (
              <form onSubmit={handleSubmit}>
                <label style={styles.label}>Name</label>
                <input
                  style={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Shopify Integration"
                  required
                />
                <label style={styles.label}>Callback URL (optional)</label>
                <input
                  style={styles.input}
                  type="url"
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  placeholder="https://your-app.com/webhooks/stock-alert"
                />
                <button style={styles.submitBtn} type="submit" disabled={saving}>
                  {saving ? "Generating..." : "Generate Key"}
                </button>
              </form>
            ) : (
              <div>
                <p style={styles.warningText}>
                  Save this key now — it will not be shown again.
                </p>
                <div style={styles.rawKeyBox}>
                  <code style={styles.rawKeyText}>{newRawKey}</code>
                  <button style={styles.copyBtn} onClick={handleCopy} title="Copy">
                    {copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
                  </button>
                </div>
                <button style={styles.submitBtn} onClick={closeForm}>
                  Done
                </button>
              </div>
            )}
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
  subtitle: { fontSize: "14px", color: "#64748b", marginTop: "4px", maxWidth: "480px" },
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
    whiteSpace: "nowrap",
  },
  section: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid #e5e7eb",
  },
  emptyText: { fontSize: "13px", color: "#94a3b8" },
  loadingText: { padding: "40px", color: "#94a3b8", fontSize: "14px" },
  tableWrap: {
    background: "#fff",
    borderRadius: "12px",
    border: "1px solid #e5e7eb",
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid #f1f5f9",
  },
  td: {
    padding: "14px 16px",
    fontSize: "13px",
    color: "#334155",
    borderBottom: "1px solid #f8fafc",
  },
  keyName: { display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#111827" },
  callbackText: {
    fontSize: "12px",
    color: "#64748b",
    fontFamily: "monospace",
    maxWidth: "220px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "inline-block",
  },
  badgeActive: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: "999px",
    background: "#dcfce7",
    color: "#16a34a",
  },
  badgeRevoked: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: "999px",
    background: "#fee2e2",
    color: "#dc2626",
  },
  iconBtn: {
    width: "28px",
    height: "28px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#dc2626",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
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
    width: "420px",
    maxWidth: "90vw",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
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
  warningText: {
    fontSize: "13px",
    color: "#b45309",
    background: "#fffbeb",
    border: "1px solid #fde68a",
    padding: "10px 12px",
    borderRadius: "8px",
    marginTop: 0,
  },
  rawKeyBox: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    background: "#0f172a",
    padding: "12px 14px",
    borderRadius: "8px",
    marginTop: "12px",
  },
  rawKeyText: {
    color: "#e2e8f0",
    fontSize: "12px",
    wordBreak: "break-all",
    fontFamily: "monospace",
  },
  copyBtn: {
    flexShrink: 0,
    width: "30px",
    height: "30px",
    borderRadius: "6px",
    border: "1px solid #334155",
    background: "#1e293b",
    color: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
};

export default ApiKeys;