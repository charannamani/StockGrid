import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Mail, Grid3x3, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";

const getPasswordStrength = (pw) => {
  if (!pw) return { level: 0, label: "", color: "#e2e8f0" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, label: "Weak", color: "#dc2626" };
  if (score <= 2) return { level: 2, label: "Fair", color: "#f59e0b" };
  if (score <= 3) return { level: 3, label: "Good", color: "#3b82f6" };
  return { level: 4, label: "Strong", color: "#16a34a" };
};

const Register = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const strength = useMemo(() => getPasswordStrength(password), [password]);

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
      {/* Animated gradient orbs */}
      <div style={styles.bgOrb1} />
      <div style={styles.bgOrb2} />

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
              id="register-name"
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
              id="register-email"
            />
          </div>

          <div style={styles.inputWrapper}>
            <Lock size={18} color="#94a3b8" />
            <input
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={styles.input}
              id="register-password"
            />
          </div>

          {/* Password strength meter */}
          {password && (
            <div style={styles.strengthContainer}>
              <div style={styles.strengthTrack}>
                <div
                  style={{
                    ...styles.strengthFill,
                    width: `${(strength.level / 4) * 100}%`,
                    backgroundColor: strength.color,
                  }}
                />
              </div>
              <span style={{ ...styles.strengthLabel, color: strength.color }}>
                {strength.label}
              </span>
            </div>
          )}

          <button type="submit" disabled={loading} style={styles.submitBtn} id="register-submit">
            {loading ? (
              <span style={styles.btnLoading}>
                <Loader2 size={18} className="spin" />
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
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
    position: "relative",
    overflow: "hidden",
  },
  bgOrb1: {
    position: "fixed",
    width: "500px",
    height: "500px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
    top: "-100px",
    right: "-50px",
    pointerEvents: "none",
    animation: "gradientShift 8s ease-in-out infinite",
  },
  bgOrb2: {
    position: "fixed",
    width: "400px",
    height: "400px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
    bottom: "-80px",
    left: "-40px",
    pointerEvents: "none",
    animation: "gradientShift 10s ease-in-out infinite reverse",
  },
  card: {
    background: "#fff",
    borderRadius: "16px",
    padding: "36px",
    width: "380px",
    maxWidth: "100%",
    boxShadow: "0 20px 50px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1)",
    animation: "modalEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
    position: "relative",
    zIndex: 1,
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
    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
  },
  brandName: { fontSize: "14px", fontWeight: 700, letterSpacing: "0.04em", color: "#111827" },
  brandSub: { fontSize: "11px", color: "#94a3b8" },
  heading: { fontSize: "22px", fontWeight: 700, color: "#111827", margin: "0 0 4px" },
  subtext: { fontSize: "14px", color: "#64748b", margin: "0 0 24px" },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    border: "1.5px solid #e2e8f0",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "14px",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  },
  input: { border: "none", outline: "none", fontSize: "14px", flex: 1 },
  strengthContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "14px",
    marginTop: "-6px",
  },
  strengthTrack: {
    flex: 1,
    height: "4px",
    background: "#f1f5f9",
    borderRadius: "999px",
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.3s ease, background-color 0.3s ease",
  },
  strengthLabel: {
    fontSize: "11px",
    fontWeight: 700,
    minWidth: "42px",
  },
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
    boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)",
    transition: "all 0.2s ease",
  },
  btnLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  footerText: { textAlign: "center", fontSize: "13px", color: "#64748b", marginTop: "20px" },
  link: { color: "#ea580c", fontWeight: 600, textDecoration: "none" },
};

export default Register;