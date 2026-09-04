import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Grid3x3 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.logoBox}>
          <Grid3x3 size={28} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={styles.logoText}>STOCKGRID</div>
          <div style={styles.logoSubtext}>Inventory Management</div>
        </div>
      </div>

      <div style={styles.background}>
        <div style={styles.card}>
          <h1 style={styles.heading}>Welcome Back!</h1>
          <p style={styles.subtext}>Log in to your StockGrid account.</p>

          <form onSubmit={handleSubmit}>
            <div style={styles.inputWrapper}>
              <User size={18} color="#94a3b8" style={styles.inputIcon} />
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
              <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
              />
            </div>

            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? "Logging in..." : "Log In"}
            </button>
          </form>

          <p style={styles.footerText}>
            New to StockGrid?{" "}
            <Link to="/register" style={styles.footerLink}>
              Create Account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 40px",
    backgroundColor: "#fff",
    borderBottom: "1px solid #e5e7eb",
  },
  logoBox: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: "20px",
    fontWeight: 800,
    color: "#1e293b",
    letterSpacing: "0.5px",
  },
  logoSubtext: {
    fontSize: "12px",
    color: "#64748b",
  },
  background: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #ef4444, #f97316, #f59e0b)",
    padding: "40px 20px",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "20px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  heading: {
    fontSize: "28px",
    fontWeight: 800,
    color: "#1e293b",
    marginBottom: "8px",
    textAlign: "center",
  },
  subtext: {
    fontSize: "14px",
    color: "#64748b",
    textAlign: "center",
    marginBottom: "32px",
  },
  inputWrapper: {
    position: "relative",
    marginBottom: "16px",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
    top: "50%",
    transform: "translateY(-50%)",
  },
  input: {
    width: "100%",
    padding: "14px 14px 14px 42px",
    borderRadius: "10px",
    border: "1.5px solid #e2e8f0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: "14px",
    borderRadius: "999px",
    border: "none",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    marginTop: "8px",
  },
  footerText: {
    textAlign: "center",
    marginTop: "24px",
    fontSize: "14px",
    color: "#475569",
  },
  footerLink: {
    color: "#f97316",
    fontWeight: 600,
    textDecoration: "none",
  },
};

export default Login;