'use client';
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Users,
  Activity,
  Shield,
  TrendingUp,
  Search,
  MoreHorizontal,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import axios from "@/lib/axiosConfig";

function LoginForm({ onLogin }) {
  const { t } = useTranslation();
  const [adminId, setAdminId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!adminId.trim() || !password.trim()) {
      setError(t("admin.enterIdAndPassword"));
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post("/api/v1/admin/login", {
        adminId: adminId.trim(),
        password,
      });
      if (res.data?.success && res.data?.data?.token) {
        localStorage.setItem("adminToken", res.data.data.token);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("admin-token-stored"));
        }
        onLogin();
      } else {
        setError(t("admin.loginFailed"));
      }
    } catch (err) {
      const msg = err.response?.data?.message || t("admin.loginFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{
        background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: "100%", maxWidth: 420 }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.15)",
            border: "2px solid rgba(16, 185, 129, 0.2)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "32px 24px", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              style={{
                width: 64,
                height: 64,
                borderRadius: "16px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
              }}
            >
              <Shield size={32} color="#fff" />
            </motion.div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#047857", marginBottom: "8px" }}>
              {t("admin.ownerOnly")}
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>{t("admin.loginTitle")}</p>
          </div>
          <form onSubmit={handleLogin} style={{ padding: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ position: "relative" }}>
                <Mail
                  size={20}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#059669",
                  }}
                />
                <input
                  type="text"
                  placeholder={t("admin.id")}
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "0 14px 0 44px",
                    border: "2px solid #a7f3d0",
                    borderRadius: "10px",
                    fontSize: "15px",
                    outline: "none",
                    color: "#111827",
                    background: "#fff",
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ position: "relative" }}>
                <Lock
                  size={20}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#059669",
                  }}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("admin.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: "100%",
                    height: 48,
                    padding: "0 44px 0 44px",
                    border: "2px solid #a7f3d0",
                    borderRadius: "10px",
                    fontSize: "15px",
                    outline: "none",
                    color: "#111827",
                    background: "#fff",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9ca3af",
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}
              >
                {error}
              </motion.p>
            )}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                height: 48,
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontSize: "16px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.35)",
              }}
            >
              {loading ? t("admin.loggingIn") : t("admin.loginBtn")}
            </button>
          </form>
        </div>
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "12px", color: "#6b7280" }}>
          <Link href="/" style={{ color: "#059669", textDecoration: "none" }}>
            {t("admin.goHome")}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("admins");
  const [searchQuery, setSearchQuery] = useState("");
  const [admins, setAdmins] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [insights, setInsights] = useState([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [pendingMappings, setPendingMappings] = useState([]);
  const [pendingMappingsTotal, setPendingMappingsTotal] = useState(0);
  const [pendingMappingsLoading, setPendingMappingsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [a, u, l, s] = await Promise.allSettled([
          axios.get("/api/v1/admin/admins"),
          axios.get("/api/v1/admin/users"),
          axios.get("/api/v1/admin/access-logs"),
          axios.get("/api/v1/admin/daily-stats"),
        ]);
        const has401 = [a, u, l, s].some(
          (p) => p.status === "rejected" && p.reason?.response?.status === 401
        );
        if (has401) {
          localStorage.removeItem("adminToken");
          onLogout();
          return;
        }
        if (a.status === "fulfilled" && a.value?.data?.success) setAdmins(a.value.data.data || []);
        if (u.status === "fulfilled" && u.value?.data?.success) setUsers(u.value.data.data || []);
        if (l.status === "fulfilled" && l.value?.data?.success) setLogs(l.value.data.data || []);
        if (s.status === "fulfilled" && s.value?.data?.success) setStats(s.value.data.data || []);
      } catch (e) {
        if (e?.response?.status === 401) {
          localStorage.removeItem("adminToken");
          onLogout();
        } else {
          console.error("대시보드 데이터 로드 실패:", e);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [onLogout]);

  useEffect(() => {
    if (activeTab !== "insights") return;
    if (insights.length > 0 || insightsLoading) return;
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    setInsightsLoading(true);
    axios
      .get("/api/v1/admin/insights/culture-vs-tour")
      .then((res) => {
        if (res?.data?.success) setInsights(res.data.data || []);
      })
      .catch((e) => {
        if (e?.response?.status === 401) {
          localStorage.removeItem("adminToken");
          onLogout();
        } else {
          console.error("인사이트 로드 실패:", e);
        }
      })
      .finally(() => setInsightsLoading(false));
  }, [activeTab, insights.length, insightsLoading, onLogout]);

  const fetchPendingMappings = React.useCallback(async () => {
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    setPendingMappingsLoading(true);
    try {
      const res = await axios.get("/api/v1/admin/cine-trip/pending-mappings?limit=100");
      if (res?.data?.success) {
        const data = res.data.data || {};
        setPendingMappings(Array.isArray(data.items) ? data.items : []);
        setPendingMappingsTotal(typeof data.total === "number" ? data.total : 0);
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        localStorage.removeItem("adminToken");
        onLogout();
      } else {
        console.error("승인 대기 매핑 로드 실패:", e);
      }
    } finally {
      setPendingMappingsLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    if (activeTab !== "pending") return;
    if (pendingMappings.length > 0 || pendingMappingsLoading) return;
    fetchPendingMappings();
  }, [activeTab, pendingMappings.length, pendingMappingsLoading, fetchPendingMappings]);

  const approvePendingMapping = async (id) => {
    try {
      await axios.post(`/api/v1/admin/cine-trip/pending-mappings/${id}/approve`);
      await fetchPendingMappings();
    } catch (e) {
      console.error("승인 실패:", e);
      alert("승인 실패: " + (e?.response?.data?.message || e.message));
    }
  };

  const rejectPendingMapping = async (id) => {
    try {
      await axios.post(`/api/v1/admin/cine-trip/pending-mappings/${id}/reject`);
      await fetchPendingMappings();
    } catch (e) {
      console.error("반려 실패:", e);
      alert("반려 실패: " + (e?.response?.data?.message || e.message));
    }
  };

  const downloadInsightsCsv = async () => {
    const token = localStorage.getItem("adminToken");
    if (!token) return;
    try {
      const res = await axios.get("/api/v1/admin/insights/culture-vs-tour.csv", {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "culture-vs-tour.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("CSV 다운로드 실패:", e);
    }
  };

  const emailCount = users.filter(u => u.provider === "email").length;
  const kakaoCount = users.filter(u => u.provider === "kakao").length;
  const appleCount = users.filter(u => u.provider === "apple").length;

  const statsCards = [
    { title: t("admin.admins"), value: admins.length, icon: Shield, color: "linear-gradient(135deg, #10b981, #059669)" },
    { title: t("admin.users"), value: users.length, icon: Users, color: "linear-gradient(135deg, #3b82f6, #06b6d4)", sub: `Email ${emailCount} / Kakao ${kakaoCount} / Apple ${appleCount}` },
    { title: t("admin.accessLogs"), value: logs.length, icon: Activity, color: "linear-gradient(135deg, #8b5cf6, #ec4899)" },
    { title: t("admin.dailyStats"), value: stats.length, icon: TrendingUp, color: "linear-gradient(135deg, #f59e0b, #ef4444)" },
  ];

  const filterList = (list, keys) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((row) =>
      keys.some((k) => String(row[k] || "").toLowerCase().includes(q))
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(16, 185, 129, 0.2)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LayoutDashboard size={22} color="#fff" />
          </div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#047857" }}>{t("admin.dashboard")}</h1>
        </div>
        <button
          onClick={onLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            border: "2px solid #a7f3d0",
            borderRadius: "10px",
            background: "#fff",
            color: "#047857",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <LogOut size={18} />
          {t("admin.logout")}
        </button>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}
        >
          {statsCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: 20,
                border: "2px solid rgba(16, 185, 129, 0.2)",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: 4 }}>{card.title}</p>
                <p style={{ fontSize: "24px", fontWeight: 700, color: "#111" }}>{card.value}</p>
                {card.sub && <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: 2 }}>{card.sub}</p>}
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "12px",
                  background: card.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <card.icon size={22} color="#fff" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "2px solid rgba(16, 185, 129, 0.2)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["admins", "users", "logs", "stats", "insights", "pending"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: activeTab === tab ? "none" : "2px solid #d1fae5",
                    background: activeTab === tab
                      ? (tab === "insights"
                          ? "linear-gradient(135deg, #6366f1, #ec4899)"
                          : tab === "pending"
                            ? "linear-gradient(135deg, #f97316, #ef4444)"
                            : "linear-gradient(135deg, #10b981, #059669)")
                      : "#fff",
                    color: activeTab === tab
                      ? "#fff"
                      : (tab === "insights" ? "#6366f1" : tab === "pending" ? "#c2410c" : "#047857"),
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {tab === "admins" && t("admin.admins")}
                  {tab === "users" && t("admin.users")}
                  {tab === "logs" && t("admin.accessLogs")}
                  {tab === "stats" && t("admin.dailyStats")}
                  {tab === "insights" && t("admin.cultureVsTour", "문화×관광")}
                  {tab === "pending" && (
                    <>
                      {t("admin.aiMappingReview", "AI 매핑 승인")}
                      {pendingMappingsTotal > 0 && (
                        <span
                          style={{
                            minWidth: 20,
                            height: 20,
                            padding: "0 6px",
                            borderRadius: 10,
                            background: activeTab === tab ? "rgba(255,255,255,0.3)" : "#fecaca",
                            color: activeTab === tab ? "#fff" : "#b91c1c",
                            fontSize: 11,
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {pendingMappingsTotal}
                        </span>
                      )}
                    </>
                  )}
                </button>
              ))}
            </div>
            <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 280 }}>
              <Search
                size={18}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }}
              />
              <input
                type="text"
                placeholder={t("admin.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px 0 40px",
                  border: "2px solid #d1fae5",
                  borderRadius: "10px",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ padding: 24, overflowX: "auto" }}>
            {loading ? (
              <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>{t("admin.loading")}</p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "admins" && (
                    <Table
                      cols={[t("admin.adminId"), t("admin.email"), t("admin.name"), t("admin.role")]}
                      fieldMap={{ [t("admin.adminId")]: "adminId", [t("admin.email")]: "adminEmail", [t("admin.name")]: "adminName", [t("admin.role")]: "role" }}
                      rows={filterList(admins, ["adminId", "adminEmail", "adminName", "role"])}
                    />
                  )}
                  {activeTab === "users" && (
                    <Table
                      cols={[t("admin.provider"), t("admin.email"), t("admin.name"), t("admin.phone"), t("admin.status"), t("admin.lastLogin")]}
                      fieldMap={{ [t("admin.provider")]: "provider", [t("admin.email")]: "email", [t("admin.name")]: "username", [t("admin.phone")]: "phone", [t("admin.status")]: "status", [t("admin.lastLogin")]: "lastLoginAt" }}
                      rows={filterList(users, ["provider", "email", "username", "phone", "status"])}
                    />
                  )}
                  {activeTab === "logs" && (
                    <Table
                      cols={[t("admin.logId"), t("admin.userId"), t("admin.platform"), t("admin.ip"), t("admin.accessTime")]}
                      fieldMap={{ [t("admin.logId")]: "accessLogId", [t("admin.userId")]: "userId", [t("admin.platform")]: "platform", [t("admin.ip")]: "reqIp", [t("admin.accessTime")]: "createdAt" }}
                      rows={filterList(logs, ["accessLogId", "userId", "platform", "reqIp"])}
                    />
                  )}
                  {activeTab === "stats" && (
                    <Table
                      cols={[t("admin.date"), t("admin.activeUsers"), t("admin.totalUsers"), "Android", "iOS", "Web"]}
                      fieldMap={{ [t("admin.date")]: "statDate", [t("admin.activeUsers")]: "activeUserCount", [t("admin.totalUsers")]: "totalUserCount", "Android": "androidCount", "iOS": "iosCount", "Web": "webCount" }}
                      rows={filterList(stats, ["statDate"])}
                    />
                  )}
                  {activeTab === "insights" && (
                    <CultureVsTourPanel
                      rows={filterList(insights, ["areaCode", "regionName"])}
                      loading={insightsLoading}
                      onDownloadCsv={downloadInsightsCsv}
                    />
                  )}
                  {activeTab === "pending" && (
                    <PendingMappingsPanel
                      rows={filterList(pendingMappings, ["movieName", "regionName", "areaCode", "mappingType"])}
                      total={pendingMappingsTotal}
                      loading={pendingMappingsLoading}
                      onApprove={approvePendingMapping}
                      onReject={rejectPendingMapping}
                      onRefresh={fetchPendingMappings}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Table({ cols, rows, fieldMap }) {
  const { t } = useTranslation();
  const getField = (col) => (fieldMap && fieldMap[col]) || col;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
          {cols.map((c) => (
            <th
              key={c}
              style={{
                padding: "12px 16px",
                textAlign: "left",
                fontWeight: 600,
                color: "#374151",
              }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={cols.length} style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
              {t("admin.noData")}
            </td>
          </tr>
        ) : (
          rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
              {cols.map((col) => {
                const key = getField(col);
                const val = row[key] ?? "-";
                return (
                  <td key={col} style={{ padding: "12px 16px", color: "#111" }}>
                    {typeof val === "object" && val !== null ? JSON.stringify(val) : String(val)}
                  </td>
                );
              })}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function CultureVsTourPanel({ rows, loading, onDownloadCsv }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
        {t("admin.loading")}
      </p>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
        <p style={{ marginBottom: 12 }}>{t("admin.insightsEmpty", "데이터가 없습니다. 관광공사 동기화 배치를 먼저 실행해 주세요.")}</p>
      </div>
    );
  }

  const totalStores = rows.reduce((s, r) => s + (Number(r.totalStores) || 0), 0);
  const totalClosed = rows.reduce((s, r) => s + (Number(r.closedStores) || 0), 0);
  const avgClosure = totalStores > 0 ? totalClosed / totalStores : 0;

  const topClosure = [...rows]
    .filter((r) => r.closureRate != null && r.totalStores > 0)
    .sort((a, b) => b.closureRate - a.closureRate)
    .slice(0, 8);
  const topSearch = [...rows]
    .filter((r) => r.searchVolume != null)
    .sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0))
    .slice(0, 8);
  const maxSearch = topSearch[0]?.searchVolume || 1;

  const KPIS = [
    { label: t("admin.insightsRegionCount", "분석 지자체 수"), value: rows.length },
    { label: t("admin.insightsTotalStores", "총 매장"), value: totalStores.toLocaleString() },
    { label: t("admin.insightsClosedStores", "폐업"), value: totalClosed.toLocaleString() },
    { label: t("admin.insightsAvgClosure", "평균 폐업률"), value: `${(avgClosure * 100).toFixed(1)}%` },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#111", margin: 0 }}>
          {t("admin.insightsTitle", "문화×관광 인사이트")}
        </h2>
        <button
          type="button"
          onClick={onDownloadCsv}
          style={{
            padding: "8px 14px",
            borderRadius: "8px",
            border: "2px solid #a5b4fc",
            background: "#eef2ff",
            color: "#4338ca",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          ⬇ {t("admin.downloadCsv", "CSV 다운로드")}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {KPIS.map((k) => (
          <div
            key={k.label}
            style={{
              background: "#fff",
              border: "2px solid #e0e7ff",
              borderRadius: 12,
              padding: "14px 16px",
            }}
          >
            <p style={{ fontSize: "12px", color: "#6366f1", margin: 0, fontWeight: 600 }}>{k.label}</p>
            <p style={{ fontSize: "20px", fontWeight: 700, color: "#111", margin: "4px 0 0" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 12px" }}>
            {t("admin.insightsTopClosure", "폐업률 상위 지자체")}
          </h3>
          {topClosure.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "13px" }}>-</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topClosure.map((r) => {
                const pct = (r.closureRate || 0) * 100;
                return (
                  <div key={r.areaCode}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: 4, color: "#374151" }}>
                      <span>{r.regionName || r.areaCode}</span>
                      <span style={{ fontWeight: 700, color: "#ef4444" }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "#fee2e2", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #f87171, #ef4444)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111", margin: "0 0 12px" }}>
            {t("admin.insightsTopSearch", "검색량 상위 지자체")}
          </h3>
          {topSearch.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "13px" }}>-</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topSearch.map((r) => {
                const pct = ((r.searchVolume || 0) / maxSearch) * 100;
                return (
                  <div key={r.areaCode}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: 4, color: "#374151" }}>
                      <span>{r.regionName || r.areaCode}</span>
                      <span style={{ fontWeight: 700, color: "#6366f1" }}>{(r.searchVolume || 0).toLocaleString()}</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "#e0e7ff", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #818cf8, #ec4899)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: 780 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
              {[
                t("admin.insightsArea", "지자체 코드"),
                t("admin.insightsRegion", "지역명"),
                t("admin.insightsTotal", "매장"),
                t("admin.insightsOperating", "영업"),
                t("admin.insightsClosed", "폐업"),
                t("admin.insightsClosureRate", "폐업률"),
                t("admin.insightsTourDemand", "관광수요"),
                t("admin.insightsCulturalDemand", "문화자원수요"),
                t("admin.insightsSearch", "검색량"),
              ].map((h) => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.areaCode} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 12px", color: "#6b7280" }}>{r.areaCode}</td>
                <td style={{ padding: "10px 12px", color: "#111", fontWeight: 600 }}>{r.regionName || "-"}</td>
                <td style={{ padding: "10px 12px" }}>{(r.totalStores || 0).toLocaleString()}</td>
                <td style={{ padding: "10px 12px", color: "#059669" }}>{(r.operatingStores || 0).toLocaleString()}</td>
                <td style={{ padding: "10px 12px", color: "#ef4444" }}>{(r.closedStores || 0).toLocaleString()}</td>
                <td style={{ padding: "10px 12px", color: "#ef4444", fontWeight: 700 }}>
                  {r.closureRate == null ? "-" : `${(r.closureRate * 100).toFixed(1)}%`}
                </td>
                <td style={{ padding: "10px 12px" }}>{r.tourDemandIdx == null ? "-" : r.tourDemandIdx.toFixed(1)}</td>
                <td style={{ padding: "10px 12px" }}>{r.culturalResourceDemand == null ? "-" : r.culturalResourceDemand.toFixed(1)}</td>
                <td style={{ padding: "10px 12px" }}>{r.searchVolume == null ? "-" : r.searchVolume.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingMappingsPanel({ rows, total, loading, onApprove, onReject, onRefresh }) {
  const { t } = useTranslation();

  const typeColor = (type) => {
    switch ((type || "").toUpperCase()) {
      case "SHOT": return { bg: "#dcfce7", fg: "#166534" };
      case "BACKGROUND": return { bg: "#dbeafe", fg: "#1e40af" };
      case "THEME": return { bg: "#fef3c7", fg: "#92400e" };
      default: return { bg: "#f3f4f6", fg: "#374151" };
    }
  };

  const sourceColor = (src) => {
    if (src === "RULE") return { bg: "#e0f2fe", fg: "#075985" };
    if (src === "LLM")  return { bg: "#fae8ff", fg: "#86198f" };
    return { bg: "#f3f4f6", fg: "#374151" };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 16px",
          background: "linear-gradient(135deg, #fff7ed, #fef2f2)",
          border: "2px solid #fecaca",
          borderRadius: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#9a3412" }}>
            {t("admin.aiMappingReview", "AI 매핑 승인")}
          </div>
          <div style={{ fontSize: 12, color: "#7c2d12", marginTop: 2 }}>
            {t(
              "admin.aiMappingReviewHint",
              "AutoTagCineTripMappingBatch 가 저신뢰도(≤2) 로 분류한 영화-지역 매핑. 승인 시 movie_region_mappings 에 즉시 반영됩니다."
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#7c2d12" }}>
            {t("admin.pendingTotal", "대기")}: <strong>{total}</strong>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "2px solid #fca5a5",
              background: "#fff",
              color: "#b91c1c",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? t("admin.loading") : t("admin.refresh", "새로고침")}
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>{t("admin.loading")}</p>
      ) : rows.length === 0 ? (
        <p style={{ textAlign: "center", color: "#6b7280", padding: 40 }}>
          {t("admin.noPending", "승인 대기 중인 매핑이 없습니다.")}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                {[
                  t("admin.pendingMovie", "영화"),
                  t("admin.pendingRegion", "지역"),
                  t("admin.pendingType", "유형"),
                  t("admin.pendingConfidence", "신뢰도"),
                  t("admin.pendingSource", "소스"),
                  t("admin.pendingEvidence", "근거"),
                  t("admin.pendingCreated", "생성일"),
                  t("admin.pendingActions", "조치"),
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#374151",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const tc = typeColor(r.mappingType);
                const sc = sourceColor(r.source);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px", color: "#111", fontWeight: 600 }}>{r.movieName}</td>
                    <td style={{ padding: "10px 12px", color: "#374151" }}>
                      {r.regionName || "-"}{" "}
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>({r.areaCode})</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: tc.bg,
                          color: tc.fg,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {r.mappingType}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#6366f1" }}>
                      {r.confidence == null ? "-" : r.confidence}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: sc.bg,
                          color: sc.fg,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {r.source}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "#4b5563",
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={r.evidence || ""}
                    >
                      {r.evidence || "-"}
                    </td>
                    <td style={{ padding: "10px 12px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                      {r.createdAt ? r.createdAt.replace("T", " ").substring(0, 16) : "-"}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => onApprove(r.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "none",
                          background: "linear-gradient(135deg, #10b981, #059669)",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          marginRight: 6,
                        }}
                      >
                        {t("admin.approve", "승인")}
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(t("admin.confirmReject", "정말 반려하시겠습니까?"))) onReject(r.id);
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 6,
                          border: "2px solid #fca5a5",
                          background: "#fff",
                          color: "#b91c1c",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {t("admin.reject", "반려")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("adminToken"));
  }, []);

  const handleLogin = () => setIsLoggedIn(true);
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("admin-token-stored"));
    }
    setIsLoggedIn(false);
  };

  return (
    <>
      {!isLoggedIn ? <LoginForm onLogin={handleLogin} /> : <Dashboard onLogout={handleLogout} />}
    </>
  );
}

export default Admin;
