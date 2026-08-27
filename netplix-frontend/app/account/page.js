'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { navigateBack } from "@/lib/navigateBack";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2, Undo2, User } from "lucide-react";

function Account() {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    if (!localStorage.getItem("token")) router.replace("/login");
  }, []);

  const CONFIRM_PHRASE = t("account.confirmPhrase");

  const handleDeleteAccount = async () => {
    if (confirmText !== CONFIRM_PHRASE) {
      alert(`'${CONFIRM_PHRASE}' ${t("account.enterConfirm")}`);
      return;
    }
    if (!window.confirm(t("account.confirmDelete"))) {
      return;
    }
    setIsDeleting(true);
    try {
      await axios.delete("/api/v1/user/me");
      localStorage.removeItem("token");
      localStorage.removeItem("refresh_token");
      alert(t("account.accountDeleted"));
      router.push("/");
      window.location.reload();
    } catch (error) {
      console.error("계정 삭제 실패:", error);
      alert(
        error.response?.data?.message || t("account.deleteFailed")
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1a2e 100%)",
        overflow: "hidden",
      }}
    >
      {/* Animated Background Orbs */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          left: "-100px",
          width: "400px",
          height: "400px",
          background: "rgba(20, 184, 166, 0.18)",
          borderRadius: "50%",
          filter: "blur(80px)",
          animation: "pulse 4s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-100px",
          right: "-100px",
          width: "400px",
          height: "400px",
          background: "rgba(34, 211, 238, 0.18)",
          borderRadius: "50%",
          filter: "blur(80px)",
          animation: "pulse 4s ease-in-out infinite",
          animationDelay: "1s",
        }}
      />

      {/* Dot Pattern Background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(rgba(20, 184, 166, 0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at center, black, transparent)",
        }}
      />

      {/* Main Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "800px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => navigateBack(router, "/dashboard")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            padding: 0,
            background: "linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "50%",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            transition: "all 0.25s ease",
            marginBottom: "24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,59,92,0.3), rgba(91,140,255,0.3))";
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,59,92,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "linear-gradient(135deg, rgba(255,59,92,0.15), rgba(91,140,255,0.15))";
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
          }}
        >
          <Undo2 size={20} strokeWidth={2.5} />
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginBottom: "32px" }}
        >
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 800,
              background: "linear-gradient(135deg, #2dd4bf, #22d3ee)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: "8px",
            }}
          >
            {t("account.title")}
          </h1>
          <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "15px" }}>
            {t("account.subtitle")}
          </p>
        </motion.div>

        {/* Glassmorphism Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            backdropFilter: "blur(20px)",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "20px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
          }}
        >
          {/* Profile Section */}
          <div style={{ padding: "32px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #14b8a6, #06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(20, 184, 166, 0.3)",
                }}
              >
                <User size={36} color="#fff" />
              </div>
              <div>
                <h3 style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>
                  {t("account.premiumMember")}
                </h3>
                <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "14px" }}>
                  {t("account.thankYou")}
                </p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div style={{ padding: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <AlertTriangle size={20} color="#f87171" />
              <h3 style={{ color: "#f87171", fontSize: "18px", fontWeight: 700 }}>
                {t("account.dangerZone")}
              </h3>
            </div>

            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <h4 style={{ color: "#fff", fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>
                {t("account.deleteAccount")}
              </h4>
              <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "14px", lineHeight: 1.6, marginBottom: "20px" }}>
                {t("account.deleteWarning")}
                {" "}{t("account.deleteConfirmInstruction")} <strong style={{ color: "#f87171" }}>"{CONFIRM_PHRASE}"</strong> {t("account.deleteConfirmSuffix")}
              </p>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 500,
                    marginBottom: "8px",
                  }}
                >
                  {t("account.confirmInput")}
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: confirmText === CONFIRM_PHRASE 
                      ? "2px solid #f87171" 
                      : "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "15px",
                    outline: "none",
                    transition: "all 0.2s ease",
                    boxSizing: "border-box",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(248, 113, 113, 0.5)";
                    e.target.style.boxShadow = "0 0 0 3px rgba(248, 113, 113, 0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = confirmText === CONFIRM_PHRASE 
                      ? "#f87171" 
                      : "rgba(255, 255, 255, 0.1)";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </div>

              <motion.button
                whileHover={confirmText === CONFIRM_PHRASE && !isDeleting ? { scale: 1.02 } : {}}
                whileTap={confirmText === CONFIRM_PHRASE && !isDeleting ? { scale: 0.98 } : {}}
                onClick={handleDeleteAccount}
                disabled={confirmText !== CONFIRM_PHRASE || isDeleting}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: confirmText === CONFIRM_PHRASE
                    ? "linear-gradient(135deg, #dc2626, #991b1b)"
                    : "rgba(255, 255, 255, 0.05)",
                  border: "none",
                  borderRadius: "12px",
                  color: confirmText === CONFIRM_PHRASE ? "#fff" : "rgba(148, 163, 184, 1)",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: confirmText === CONFIRM_PHRASE && !isDeleting ? "pointer" : "not-allowed",
                  opacity: isDeleting ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                }}
              >
                {isDeleting ? (
                  t("account.processing")
                ) : (
                  <>
                    <Trash2 size={18} />
                    {t("account.deleteBtn")}
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{ marginTop: "32px", textAlign: "center" }}
        >
          <p style={{ color: "rgba(148, 163, 184, 1)", fontSize: "14px" }}>
            {t("account.needHelp")}{" "}
            <button
              onClick={() => router.push("/support")}
              style={{
                background: "none",
                border: "none",
                color: "#2dd4bf",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {t("account.customerSupport")}
            </button>
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}

export default Account;
