import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

const Layout = () => {
  return (
    <div style={styles.container}>
      <Sidebar />
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "#f8fafc",
  },
  content: {
    flex: 1,
    padding: "28px 32px",
    overflowY: "auto",
  },
};

export default Layout;