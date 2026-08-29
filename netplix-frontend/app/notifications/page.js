'use client';
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import BatchNotificationPosters from "@/components/BatchNotificationPosters";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Film, Sparkles, Megaphone, BellOff } from "lucide-react";

function Notifications() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => { setIsLoggedIn(!!localStorage.getItem("token")); }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    loadNotifications();
  }, [isLoggedIn, router]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/v1/notifications");
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setNotifications(res.data.data);
      }
    } catch (e) {
      console.error("알림 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`/api/v1/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, isRead: true } : n
        )
      );
    } catch (e) {
      console.error("읽음 처리 실패:", e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post("/api/v1/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error("전체 읽음 처리 실패:", e);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "NEW_RELEASE":
        return <Film size={20} />;
      case "RECOMMENDATION":
        return <Sparkles size={20} />;
      case "SYSTEM":
        return <Megaphone size={20} />;
      default:
        return <Bell size={20} />;
    }
  };

  const getIconColor = (type) => {
    switch (type) {
      case "NEW_RELEASE":
        return "rgba(96, 165, 250, 1)";
      case "RECOMMENDATION":
        return "rgba(251, 191, 36, 1)";
      case "SYSTEM":
        return "rgba(244, 114, 182, 1)";
      default:
        return "rgba(167, 139, 250, 1)";
    }
  };

  const formatDate = (dateVal) => {
    if (!dateVal) return "";
    let date;
    if (Array.isArray(dateVal)) {
      const [y, mo, d, h = 0, mi = 0, s = 0] = dateVal;
      date = new Date(y, mo - 1, d, h, mi, s);
    } else {
      date = new Date(dateVal);
    }
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("mypage.justNow");
    if (diffMins < 60) return t("mypage.minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("mypage.hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("mypage.daysAgo", { count: diffDays });
    return date.toLocaleDateString(
      i18n.language?.startsWith("en") ? "en-US"
        : i18n.language?.startsWith("pt") ? "pt-BR"
        : i18n.language?.startsWith("ja") ? "ja-JP"
        : i18n.language?.startsWith("zh") ? "zh-CN"
        : "ko-KR"
    );
  };

  const getDateKey = (dateVal) => {
    if (!dateVal) return "";
    let date;
    if (Array.isArray(dateVal)) {
      const [y, mo, d] = dateVal;
      date = new Date(y, mo - 1, d);
    } else {
      date = new Date(dateVal);
    }
    if (isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #0f172a 0%, #581c87 50%, #831843 100%)",
        overflow: "hidden",
      }}
    >
      {/* Animated Background Orbs */}
      <div
        style={{
          position: "absolute",
          top: "-200px",
          left: "-200px",
          width: "500px",
          height: "500px",
          background: "rgba(236, 72, 153, 0.2)",
          borderRadius: "50%",
          filter: "blur(100px)",
          animation: "pulse 4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-200px",
          right: "-200px",
          width: "500px",
          height: "500px",
          background: "rgba(139, 92, 246, 0.2)",
          borderRadius: "50%",
          filter: "blur(100px)",
          animation: "pulse 4s ease-in-out infinite",
          animationDelay: "1s",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "40%",
          width: "400px",
          height: "400px",
          background: "rgba(244, 114, 182, 0.1)",
          borderRadius: "50%",
          filter: "blur(80px)",
          animation: "pulse 6s ease-in-out infinite",
          animationDelay: "2s",
        }}
      />

      {/* Main Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "800px",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: "32px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  padding: "12px",
                  borderRadius: "16px",
                  background: "linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2))",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(236, 72, 153, 0.2)",
                }}
              >
                <Bell size={32} color="rgba(244, 114, 182, 1)" />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    background: "linear-gradient(135deg, #f472b6, #a78bfa)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    marginBottom: "4px",
                  }}
                >
                  {t("mypage.notifications")}
                </h1>
                {unreadCount > 0 && (
                  <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "14px" }}>
                    {t("mypage.unreadCount", { count: unreadCount })}
                  </p>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={markAllAsRead}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  background: "rgba(255, 255, 255, 0.05)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(236, 72, 153, 0.2)",
                  borderRadius: "12px",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                <CheckCheck size={16} />
                {t("mypage.markAllRead")}
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* Notifications List */}
        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              padding: "60px 20px",
              textAlign: "center",
              backdropFilter: "blur(20px)",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                border: "3px solid rgba(244, 114, 182, 0.2)",
                borderTopColor: "rgba(244, 114, 182, 1)",
                borderRadius: "50%",
                margin: "0 auto 16px",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "16px" }}>
              {t("mypage.loadingNotifications")}
            </p>
          </motion.div>
        ) : notifications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "80px 20px",
              textAlign: "center",
              backdropFilter: "blur(20px)",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
            }}
          >
            <div
              style={{
                padding: "24px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2))",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(236, 72, 153, 0.2)",
                display: "inline-flex",
                marginBottom: "24px",
              }}
            >
              <BellOff size={48} color="rgba(244, 114, 182, 1)" />
            </div>
            <h3 style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
              {t("mypage.noNotifications")}
            </h3>
            <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "15px" }}>
              {t("mypage.noNotificationsDesc")}
            </p>
          </motion.div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {notifications.map((notification, index) => {
              const currentDateKey = getDateKey(notification.sentAt);
              const prevDateKey = index > 0 ? getDateKey(notifications[index - 1].sentAt) : null;
              const showSeparator = index > 0 && currentDateKey && currentDateKey !== prevDateKey;
              return (
              <React.Fragment key={notification.notificationId}>
              {showSeparator && (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "4px 0", margin: "0 -12px",
                }}>
                  <div style={{
                    width: "100%", maxWidth: "calc(100% + 24px)", height: "1px",
                    background: "linear-gradient(90deg, transparent 0%, rgba(148,163,184,0.3) 15%, rgba(148,163,184,0.3) 85%, transparent 100%)",
                  }} />
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => !notification.isRead && markAsRead(notification.notificationId)}
                style={{
                  padding: "20px",
                  backdropFilter: "blur(20px)",
                  background: notification.isRead
                    ? "rgba(255, 255, 255, 0.03)"
                    : "rgba(255, 255, 255, 0.08)",
                  border: notification.isRead
                    ? "1px solid rgba(255, 255, 255, 0.05)"
                    : "1px solid rgba(236, 72, 153, 0.3)",
                  borderRadius: "16px",
                  cursor: notification.isRead ? "default" : "pointer",
                  transition: "all 0.3s ease",
                  boxShadow: notification.isRead
                    ? "none"
                    : "0 8px 32px rgba(236, 72, 153, 0.1)",
                }}
                whileHover={!notification.isRead ? { scale: 1.01 } : {}}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                  {/* Icon */}
                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "12px",
                      background: "linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.1))",
                      backdropFilter: "blur(20px)",
                      border: "1px solid rgba(236, 72, 153, 0.2)",
                      color: getIconColor(notification.notificationType),
                      flexShrink: 0,
                    }}
                  >
                    {getNotificationIcon(notification.notificationType)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        marginBottom: "6px",
                      }}
                    >
                      <h3
                        style={{
                          color: "#fff",
                          fontSize: "15px",
                          fontWeight: notification.isRead ? 500 : 700,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {notification.title}
                        {!notification.isRead && (
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
                              animation: "pulse 2s ease-in-out infinite",
                            }}
                          />
                        )}
                      </h3>
                      <span
                        style={{
                          padding: "4px 10px",
                          background: "rgba(255, 255, 255, 0.05)",
                          backdropFilter: "blur(10px)",
                          border: "1px solid rgba(236, 72, 153, 0.2)",
                          borderRadius: "6px",
                          color: "rgba(148, 163, 184, 1)",
                          fontSize: "12px",
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {formatDate(notification.sentAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        color: "rgba(148, 163, 184, 1)",
                        fontSize: "14px",
                        lineHeight: 1.5,
                        opacity: notification.isRead ? 0.7 : 1,
                      }}
                    >
                      {notification.message}
                    </p>
                    <BatchNotificationPosters title={notification.title} message={notification.message} relatedId={notification.relatedId} />
                  </div>
                </div>
              </motion.div>
              </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Notifications;
