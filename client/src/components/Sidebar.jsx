import { NavLink, useNavigate } from "react-router-dom";
import {
  Grid3x3,
  LayoutDashboard,
  Warehouse,
  Package,
  Boxes,
  ArrowLeftRight,
  Truck,
  BookmarkCheck,
  Users,
  KeyRound,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navSections = [
  {
    title: "OPERATIONS",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/warehouses", label: "Warehouses", icon: Warehouse },
      { to: "/products", label: "Product Catalog", icon: Package },
      { to: "/stock", label: "Inventory & Router", icon: Boxes },
      { to: "/movements", label: "Movement Ledger", icon: ArrowLeftRight },
      { to: "/transfers", label: "Stock Transfers", icon: Truck },
      { to: "/reservations", label: "Stock Reservations", icon: BookmarkCheck },
    ],
  },
  {
    title: "ADMINISTRATION",
    adminOnly: true,
    items: [
      { to: "/users", label: "User Access & RBAC", icon: Users },
      { to: "/api-keys", label: "API Credentials", icon: KeyRound },
    ],
  },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isAdmin = user?.role === "admin";

  return (
    <aside style={styles.sidebar}>
      {/* Brand Header */}
      <div style={styles.brand}>
        <div style={styles.logoContainer}>
          <div style={styles.logoMark}>
            <Grid3x3 size={18} color="#fff" strokeWidth={2.5} />
          </div>
          <div style={styles.logoGlow} />
        </div>
        <div style={styles.brandTextContainer}>
          <div style={styles.brandTitleRow}>
            <span style={styles.brandName}>STOCKGRID</span>
            <span style={styles.versionBadge}>v2.0</span>
          </div>
          <div style={styles.systemStatusRow}>
            <span style={styles.liveDot} />
            <span style={styles.brandSub}>Network Live</span>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav style={styles.nav}>
        {navSections
          .filter((section) => !section.adminOnly || isAdmin)
          .map((section) => (
            <div key={section.title} style={styles.sectionGroup}>
              <div style={styles.sectionHeading}>{section.title}</div>
              <div style={styles.sectionItems}>
                {section.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    style={({ isActive }) => ({
                      ...styles.navLink,
                      ...(isActive ? styles.navLinkActive : {}),
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <div
                          style={{
                            ...styles.iconWrapper,
                            ...(isActive ? styles.iconWrapperActive : {}),
                          }}
                        >
                          <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                        </div>
                        <span style={styles.navLabel}>{label}</span>
                        {isActive && <div style={styles.activeIndicator} />}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
      </nav>

      {/* User & Footer */}
      <div style={styles.footer}>
        <div style={styles.userCard}>
          <div style={styles.avatarWrapper}>
            <div
              style={{
                ...styles.avatar,
                background: isAdmin
                  ? "linear-gradient(135deg, #ef4444, #f59e0b)"
                  : "linear-gradient(135deg, #3b82f6, #06b6d4)",
              }}
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div style={styles.onlineBadge} />
          </div>
          <div style={styles.userInfo}>
            <div style={styles.userName} title={user?.name || "User"}>
              {user?.name || "User"}
            </div>
            <div style={styles.roleBadgeContainer}>
              <span
                style={{
                  ...styles.rolePill,
                  backgroundColor: isAdmin ? "#fef2f2" : "#eff6ff",
                  color: isAdmin ? "#dc2626" : "#2563eb",
                  borderColor: isAdmin ? "#fee2e2" : "#dbeafe",
                }}
              >
                {isAdmin ? "Global Admin" : "Floor Staff"}
              </span>
            </div>
          </div>
        </div>

        <button style={styles.logoutBtn} onClick={handleLogout} title="Sign out">
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
};

const styles = {
  sidebar: {
    width: "256px",
    height: "100vh",
    background: "#ffffff",
    borderRight: "1px solid #e2e8f0",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    boxShadow: "1px 0 3px rgba(0, 0, 0, 0.02)",
    zIndex: 40,
    userSelect: "none",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 18px",
    borderBottom: "1px solid #f1f5f9",
  },
  logoContainer: {
    position: "relative",
  },
  logoMark: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
    zIndex: 2,
    position: "relative",
  },
  logoGlow: {
    position: "absolute",
    inset: "-2px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
    filter: "blur(6px)",
    opacity: 0.35,
    zIndex: 1,
  },
  brandTextContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  brandTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  brandName: {
    fontSize: "14px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    color: "#0f172a",
  },
  versionBadge: {
    fontSize: "9px",
    fontWeight: 700,
    padding: "1px 4px",
    borderRadius: "4px",
    background: "#f1f5f9",
    color: "#64748b",
  },
  systemStatusRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    backgroundColor: "#10b981",
    boxShadow: "0 0 6px #10b981",
  },
  brandSub: {
    fontSize: "11px",
    color: "#94a3b8",
    fontWeight: 500,
  },
  nav: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  sectionGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  sectionHeading: {
    fontSize: "10px",
    fontWeight: 700,
    color: "#94a3b8",
    letterSpacing: "0.08em",
    padding: "0 10px 4px 10px",
  },
  sectionItems: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "9px 12px",
    borderRadius: "8px",
    color: "#475569",
    fontSize: "13px",
    fontWeight: 500,
    textDecoration: "none",
    position: "relative",
    transition: "all 0.15s ease",
  },
  navLinkActive: {
    background: "linear-gradient(135deg, #fff7ed, #ffedd5)",
    color: "#ea580c",
    fontWeight: 600,
  },
  iconWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    transition: "color 0.15s ease",
  },
  iconWrapperActive: {
    color: "#ea580c",
  },
  navLabel: {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  activeIndicator: {
    width: "4px",
    height: "16px",
    borderRadius: "999px",
    background: "linear-gradient(135deg, #ef4444, #f59e0b)",
  },
  footer: {
    padding: "14px",
    borderTop: "1px solid #f1f5f9",
    background: "#fafbfc",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "10px",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
  },
  avatarWrapper: {
    position: "relative",
    flexShrink: 0,
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineBadge: {
    position: "absolute",
    bottom: "-1px",
    right: "-1px",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#10b981",
    border: "1.5px solid #ffffff",
  },
  userInfo: {
    overflow: "hidden",
    flex: 1,
  },
  userName: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#0f172a",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  roleBadgeContainer: {
    marginTop: "2px",
  },
  rolePill: {
    fontSize: "10px",
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: "4px",
    border: "1px solid",
    display: "inline-block",
  },
  logoutBtn: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#64748b",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
};

export default Sidebar;