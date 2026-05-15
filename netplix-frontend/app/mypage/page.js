'use client';
import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Heart, Bell, Film, Sparkles, Megaphone, CheckCheck, BellOff } from "lucide-react";
import axios from "@/lib/axiosConfig";
import BatchNotificationPosters from "@/components/BatchNotificationPosters";

function MypageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation();
  const [authChecked, setAuthChecked] = useState(false);
  const [likedMovies, setLikedMovies] = useState([]);
  const [likedLoading, setLikedLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(true);

  // 카카오 OAuth2(서버 리다이렉트) 등: URL 쿼리의 토큰을 저장한 뒤 주소창에서 제거
  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refresh_token");
    if (token) {
      localStorage.setItem("token", token);
      if (refreshToken) {
        localStorage.setItem("refresh_token", refreshToken);
      }
      sessionStorage.setItem("oauth_callback_ts", Date.now().toString());
      router.replace(pathname);
      window.dispatchEvent(new CustomEvent("token-stored"));
    }
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.replace("/login");
    } else {
      setAuthChecked(true);
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (!authChecked) return;
    const loadLiked = async () => {
      try {
        const res = await axios.get("/api/v1/user/me/liked-movies");
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setLikedMovies(res.data.data);
        }
      } catch (e) {
        console.error("찜 목록 로드 실패:", e);
      } finally {
        setLikedLoading(false);
      }
    };
    const loadNotifications = async () => {
      try {
        const res = await axios.get("/api/v1/notifications");
        if (res.data?.success && Array.isArray(res.data?.data)) {
          setNotifications(res.data.data);
        }
      } catch (e) {
        console.error("알림 로드 실패:", e);
      } finally {
        setNotifLoading(false);
      }
    };
    loadLiked();
    loadNotifications();
  }, [authChecked]);

  const markAsRead = async (notificationId) => {
    try {
      await axios.post(`/api/v1/notifications/${notificationId}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true } : n))
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
    return date.toLocaleDateString(i18n.language === "en" ? "en-US" : "ko-KR");
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

  if (!authChecked) return null;

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
      {/* Animated Background Orbs (알림 화면과 동일) */}
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
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        {/* 알림 섹션 (위쪽) */}
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

          {notifLoading ? (
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
              {notifications.map((n, index) => {
                const currentDateKey = getDateKey(n.sentAt);
                const prevDateKey = index > 0 ? getDateKey(notifications[index - 1].sentAt) : null;
                const showSeparator = index > 0 && currentDateKey && currentDateKey !== prevDateKey;
                return (
                <React.Fragment key={n.notificationId}>
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
                  onClick={() => !n.isRead && markAsRead(n.notificationId)}
                  style={{
                    padding: "20px",
                    backdropFilter: "blur(20px)",
                    background: n.isRead
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(255, 255, 255, 0.08)",
                    border: n.isRead
                      ? "1px solid rgba(255, 255, 255, 0.05)"
                      : "1px solid rgba(236, 72, 153, 0.3)",
                    borderRadius: "16px",
                    cursor: n.isRead ? "default" : "pointer",
                    transition: "all 0.3s ease",
                    boxShadow: n.isRead ? "none" : "0 8px 32px rgba(236, 72, 153, 0.1)",
                  }}
                  whileHover={!n.isRead ? { scale: 1.01 } : {}}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                    <div
                      style={{
                        padding: "12px",
                        borderRadius: "12px",
                        background: "linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(139, 92, 246, 0.1))",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(236, 72, 153, 0.2)",
                        color: getIconColor(n.notificationType),
                        flexShrink: 0,
                      }}
                    >
                      {getNotificationIcon(n.notificationType)}
                    </div>
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
                            fontWeight: n.isRead ? 500 : 700,
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          {n.title}
                          {!n.isRead && (
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
                          {formatDate(n.sentAt)}
                        </span>
                      </div>
                      <p
                        style={{
                          color: "rgba(148, 163, 184, 1)",
                          fontSize: "14px",
                          lineHeight: 1.5,
                          opacity: n.isRead ? 0.7 : 1,
                        }}
                      >
                        {n.message}
                      </p>
                      <BatchNotificationPosters title={n.title} message={n.message} relatedId={n.relatedId} />
                    </div>
                  </div>
                </motion.div>
                </React.Fragment>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* 내 찜 목록 (알림 아래) */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginBottom: "32px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                padding: "12px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(139, 92, 246, 0.2))",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(236, 72, 153, 0.2)",
              }}
            >
              <Heart size={28} color="rgba(244, 114, 182, 1)" />
            </div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 800,
                background: "linear-gradient(135deg, #f472b6, #a78bfa)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                margin: 0,
              }}
            >
              {t("mypage.likedList")}
            </h2>
          </div>

          {likedLoading ? (
            <div
              style={{
                padding: "40px 20px",
                textAlign: "center",
                backdropFilter: "blur(20px)",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "20px",
              }}
            >
              <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "16px" }}>
                {t("mypage.loadingLiked")}
              </p>
            </div>
          ) : likedMovies.length > 0 ? (
            <div
              style={{
                display: "flex",
                gap: "12px",
                overflowX: "auto",
                paddingBottom: "8px",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {likedMovies.map((item, idx) => {
                const ct = item.contentType || "dvd";
                return (
                  <motion.div
                    key={`liked-${item.movieName}-${idx}`}
                    whileHover={{ scale: 1.02 }}
                    style={{
                      flex: "0 0 auto",
                      width: "140px",
                      minWidth: "140px",
                      borderRadius: "16px",
                      overflow: "hidden",
                      backdropFilter: "blur(20px)",
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(236, 72, 153, 0.2)",
                      boxShadow: "0 8px 32px rgba(236, 72, 153, 0.1)",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        margin: 0,
                        padding: 0,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        display: "block",
                      }}
                      onClick={() =>
                        router.push(`/dashboard/images?movieName=${encodeURIComponent(item.movieName)}&contentType=${ct}`)
                      }
                    >
                      {item.posterPath ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w342${item.posterPath}`}
                          alt=""
                          draggable={false}
                          style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <img
                          src="/no-poster-placeholder.png"
                          alt=""
                          style={{ width: "100%", height: "200px", objectFit: "cover", display: "block" }}
                        />
                      )}
                    </button>
                    <button
                      type="button"
                      style={{
                        width: "100%",
                        padding: "12px 10px",
                        border: "none",
                        background: "transparent",
                        color: "#fff",
                        fontSize: "14px",
                        fontWeight: 600,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        router.push(`/dashboard/images?movieName=${encodeURIComponent(item.movieName)}&contentType=${ct}`)
                      }
                    >
                      {item.movieName}
                    </button>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: "60px 20px",
                textAlign: "center",
                backdropFilter: "blur(20px)",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "20px",
              }}
            >
              <Heart size={40} color="rgba(244, 114, 182, 0.6)" style={{ marginBottom: "16px" }} />
              <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
                {t("mypage.noLiked")}
              </h3>
              <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "14px" }}>
                {t("mypage.noLikedDesc")}
              </p>
            </motion.div>
          )}
        </motion.section>
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

export default function Mypage() {
  return (
    <Suspense fallback={null}>
      <MypageContent />
    </Suspense>
  );
}
