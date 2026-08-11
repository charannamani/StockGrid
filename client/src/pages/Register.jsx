import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Mail, Grid3x3 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(name, email, password);
      toast.success("Account created!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoMark}>
            <Grid3x3 size={20} color="#fff" />
          </div>
          <div>
            <div style={styles.brandName}>STOCKGRID</div>
            <div style={styles.brandSub}>Inventory Management</div>
          </div>
        </div>

        <h1 style={styles.heading}>Create Account</h1>
        <p style={styles.subtext}>Get started managing your warehouses.</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.inputWrapper}>
            <User size={18} color="#94a3b8" />
            <input
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputWrapper}>
            <Mail size={18} color="#94a3b8" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
            />
          </div>

          <div style={styles.inputWrapper}>
            <Lock size={18} color="#94a3b8" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} style={styles.submitBtn}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p style={styles.footerText}>
          Already have an account?{" "}
          <Link to="/login" style={styles.link}>Log In</Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #ef4444, #f59e0b, #fde047)",
    padding: "20px",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "36px",
    width: "380px",
    maxWidth: "100%",
    boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
  },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" },
  logoMark: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: "14px", fontWeight: 700, letterSpacing: "0.04em", color: "#111827" },
  brandSub: { fontSize: "11px", color: "#94a3b8" },
  heading: { fontSize: "22px", fontWeight: 700, color: "#111827", margin: "0 0 4px" },
  subtext: { fontSize: "14px", color: "#64748b", margin: "0 0 24px" },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "14px",
  },
  input: { border: "none", outline: "none", fontSize: "14px", flex: 1 },
  submitBtn: {
    width: "100%",
    padding: "13px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: "6px",
  },
  footerText: { textAlign: "center", fontSize: "13px", color: "#64748b", marginTop: "20px" },
  link: { color: "#ea580c", fontWeight: 600, textDecoration: "none" },
};

export default Register;