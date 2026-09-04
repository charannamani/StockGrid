import { NavLink, useNavigate } from "react-router-dom";
import {
  Grid3x3,
  LayoutDashboard,
  Warehouse,
  Package,
  Boxes,
  ArrowLeftRight,
  KeyRound,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/warehouses", label: "Warehouses", icon: Warehouse },
  { to: "/products", label: "Products", icon: Package },
  { to: "/stock", label: "Inventory & Router", icon: Boxes },
  { to: "/movements", label: "Movements", icon: ArrowLeftRight },
  { to: "/api-keys", label: "API Keys", icon: KeyRound, adminOnly: true },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.brand}>
        <div style={styles.logoMark}>
          <Grid3x3 size={18} color="#fff" />
        </div>
        <div>
          <div style={styles.brandName}>STOCKGRID</div>
          <div style={styles.brandSub}>Warehouse Network</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {navItems
          .filter((item) => !item.adminOnly || user?.role === "admin")
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
      </nav>

      <div style={styles.footer}>
        <div style={styles.userBlock}>
          <div style={styles.avatar}>
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name || "User"}</div>
            <div style={styles.userRole}>{user?.role || "staff"}</div>
          </div>
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: "240px",
    height: "100vh",
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "20px",
    borderBottom: "1px solid #f1f5f9",
  },
  logoMark: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  brandName: {
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    color: "#111827",
  },
  brandSub: {
    fontSize: "11px",
    color: "#94a3b8",
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "16px 12px",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    borderRadius: "8px",
    color: "#475569",
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
    transition: "background 0.15s ease, color 0.15s ease",
  },
  navLinkActive: {
    background: "linear-gradient(135deg, #fef2f2, #fff7ed)",
    color: "#ea580c",
    fontWeight: 600,
  },
  footer: {
    padding: "16px",
    borderTop: "1px solid #f1f5f9",
  },
  userBlock: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userInfo: {
    overflow: "hidden",
  },
  userName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#111827",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    fontSize: "11px",
    color: "#94a3b8",
    textTransform: "capitalize",
  },
  logoutBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "9px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
};

export default Sidebar;