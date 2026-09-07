import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Grid3x3, Eye, EyeOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      {/* Animated gradient background */}
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />
      <div style={styles.bgOrb3} />

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
                id="login-email"
              />
            </div>

            <div style={styles.inputWrapper}>
              <Lock size={18} color="#94a3b8" style={styles.inputIcon} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles.input}
                id="login-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button type="submit" disabled={loading} style={styles.button} id="login-submit">
              {loading ? (
                <span style={styles.btnLoading}>
                  <Loader2 size={18} className="spin" />
                  Logging in...
                </span>
              ) : (
                "Log In"
              )}
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
    position: "relative",
    overflow: "hidden",
  },
  bgOrb1: {
    position: "fixed",
    width: "600px",
    height: "600px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)",
    top: "-200px",
    right: "-100px",
    pointerEvents: "none",
    animation: "gradientShift 8s ease-in-out infinite",
  },
  bgOrb2: {
    position: "fixed",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%)",
    bottom: "-150px",
    left: "-100px",
    pointerEvents: "none",
    animation: "gradientShift 10s ease-in-out infinite reverse",
  },
  bgOrb3: {
    position: "fixed",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    animation: "gradientShift 12s ease-in-out infinite",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 40px",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(10px)",
    borderBottom: "1px solid #e5e7eb",
    position: "relative",
    zIndex: 2,
  },
  logoBox: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
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
    position: "relative",
    zIndex: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "20px",
    padding: "48px 40px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.1)",
    animation: "modalEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
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
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "14px 42px 14px 42px",
    borderRadius: "10px",
    border: "1.5px solid #e2e8f0",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  },
  eyeBtn: {
    position: "absolute",
    right: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#94a3b8",
    cursor: "pointer",
    padding: "4px",
    display: "flex",
    alignItems: "center",
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
    boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)",
    transition: "all 0.2s ease",
  },
  btnLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
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