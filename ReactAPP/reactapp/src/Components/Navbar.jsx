import "./Navbar.css";
import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Home", id: "home", path: "/home" },
  { label: "RAG", id: "upload", path: "/rag" },
  { label: "Ask Questions", id: "query", path: "/page1" },
  { label: "Documents", id: "documents", path: "/page2" },
];

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/home" end className="navbar-brand">
        <span className="brand-logo">Rag</span>
        <span>Document RAG AI</span>
      </NavLink>

      <div className="navbar-links">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `nav-link ${isActive ? "active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
