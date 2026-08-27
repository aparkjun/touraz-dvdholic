'use client';

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { navigateBack } from "@/lib/navigateBack";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, HelpCircle, ChevronDown, Undo2, Send, CheckCircle, AlertCircle } from "lucide-react";
import axios from "@/lib/axiosConfig";

function Support() {
  const router = useRouter();
  const { t } = useTranslation();
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [floatingParticles, setFloatingParticles] = useState([]);

  useEffect(() => {
    setFloatingParticles([...Array(15)].map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 4 + Math.random() * 4,
      delay: Math.random() * 2,
    })));
  }, []);
  const containerRef = useRef(null);

  const supportEmail = "kparkjun@gmail.com";
  const appName = "Touraz Holic";

  const faqItems = [
    { id: "1", question: t("support.faq1q"), answer: t("support.faq1a") },
    { id: "2", question: t("support.faq2q"), answer: t("support.faq2a") },
    { id: "3", question: t("support.faq3q"), answer: t("support.faq3a") },
    { id: "4", question: t("support.faq4q"), answer: t("support.faq4a") },
    { id: "5", question: t("support.faq5q"), answer: t("support.faq5a") },
  ];

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const [sendResult, setSendResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message) return;

    setIsSending(true);
    setSendResult(null);
    try {
      const res = await axios.post("/api/v1/support/contact", { message });
      const status = res.data?.data?.status;
      if (status === "SENT") {
        setSendResult("success");
        setMessage("");
      } else {
        setSendResult("fail");
      }
    } catch {
      setSendResult("fail");
    } finally {
      setIsSending(false);
      setTimeout(() => setSendResult(null), 5000);
    }
  };

  // Animated Gradient Background
  useEffect(() => {
    let animationFrame;
    let width = 125;
    let directionWidth = 1;
    const breathingRange = 5;
    const animationSpeed = 0.02;
    
    const gradientColors = [
      "#0A0A0A",
      "#6366F1",
      "#8B5CF6",
      "#A855F7",
      "#C084FC",
      "#E879F9",
      "#F0ABFC"
    ];
    const gradientStops = [35, 50, 60, 70, 80, 90, 100];

    const animateGradient = () => {
      if (width >= 125 + breathingRange) directionWidth = -1;
      if (width <= 125 - breathingRange) directionWidth = 1;
      width += directionWidth * animationSpeed;

      const gradientStopsString = gradientStops
        .map((stop, index) => `${gradientColors[index]} ${stop}%`)
        .join(", ");

      const gradient = `radial-gradient(${width}% ${width}% at 50% 20%, ${gradientStopsString})`;

      if (containerRef.current) {
        containerRef.current.style.background = gradient;
      }

      animationFrame = requestAnimationFrame(animateGradient);
    };

    animationFrame = requestAnimationFrame(animateGradient);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.23, 0.86, 0.39, 0.96]
      }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
      {/* Animated Background */}
      <motion.div
        initial={{ opacity: 0, scale: 1.5 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 2, ease: [0.25, 0.1, 0.25, 1] } }}
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      >
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      </motion.div>

      {/* Floating particles */}
      {floatingParticles.map((p) => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            width: "4px",
            height: "4px",
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: "50%",
            left: `${p.left}%`,
            top: `${p.top}%`,
          }}
          animate={{
            y: [0, -100, 0],
            opacity: [0.2, 1, 0.2],
            scale: [1, 2, 1],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
        />
      ))}

      {/* Main Content */}
      <motion.div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "1100px",
          margin: "0 auto",
          padding: "40px 20px",
        }}
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
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
            marginBottom: "32px",
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
          variants={fadeInUp}
          style={{ textAlign: "center", marginBottom: "48px" }}
        >
          <motion.div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 20px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "999px",
              marginBottom: "24px",
            }}
            whileHover={{ scale: 1.05 }}
          >
            <HelpCircle size={16} color="rgba(165, 180, 252, 1)" />
            <span style={{ fontSize: "14px", fontWeight: 500, color: "rgba(255, 255, 255, 0.8)" }}>
              Premium Support
            </span>
          </motion.div>

          <h1
            style={{
              fontSize: "clamp(36px, 7vw, 64px)",
              fontWeight: 800,
              marginBottom: "16px",
              lineHeight: 1.1,
            }}
          >
            <span style={{ color: "#fff" }}>{t("support.needHelp")}</span>
            <br />
            <motion.span
              style={{
                background: "linear-gradient(135deg, #a5b4fc, #c084fc, #f472b6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                backgroundSize: "200% 200%",
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              {t("support.contactAnytime")}
            </motion.span>
          </h1>

          <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "18px", maxWidth: "600px", margin: "0 auto" }}>
            {t("support.headerDesc", { appName })}
          </p>
        </motion.div>

        {/* Contact Form Card */}
        <motion.div
          variants={fadeInUp}
          style={{
            backdropFilter: "blur(20px)",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "24px",
            overflow: "hidden",
            marginBottom: "32px",
          }}
        >
          {/* Card Header */}
          <div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(255, 255, 255, 0.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mail size={24} color="rgba(165, 180, 252, 1)" />
              </div>
              <div>
                <h2 style={{ color: "#fff", fontSize: "22px", fontWeight: 700, marginBottom: "4px" }}>
                  {t("support.contactUs")}
                </h2>
                <p style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "14px" }}>
                  {t("support.contactDesc")}
                </p>
              </div>
            </div>
          </div>

          {/* Card Content - Form */}
          <form onSubmit={handleSubmit} style={{ padding: "24px 32px" }}>
            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="message"
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "rgba(255, 255, 255, 0.8)",
                  marginBottom: "8px",
                }}
              >
                {t("support.messageContent")}
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("support.messagePlaceholder")}
                required
                rows={4}
                style={{
                  width: "100%",
                  padding: "14px 18px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#fff",
                  fontSize: "15px",
                  outline: "none",
                  transition: "all 0.2s ease",
                  resize: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(99, 102, 241, 0.5)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.2)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <motion.button
              type="submit"
              disabled={isSending}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: "100%",
                padding: "16px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: "14px",
                color: "#fff",
                fontSize: "16px",
                fontWeight: 600,
                cursor: isSending ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 15px rgba(99, 102, 241, 0.3)",
              }}
            >
              <Send size={18} />
              {isSending ? t("support.sending") : t("support.sendMessage")}
            </motion.button>

            <AnimatePresence>
              {sendResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    marginTop: "16px",
                    padding: "14px 18px",
                    borderRadius: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: sendResult === "success"
                      ? "rgba(34, 197, 94, 0.12)"
                      : "rgba(239, 68, 68, 0.12)",
                    border: `1px solid ${sendResult === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                  }}
                >
                  {sendResult === "success"
                    ? <CheckCircle size={18} color="#22c55e" />
                    : <AlertCircle size={18} color="#ef4444" />}
                  <span style={{
                    color: sendResult === "success" ? "#22c55e" : "#ef4444",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}>
                    {sendResult === "success" ? t("support.sendSuccess") : t("support.sendFail")}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Direct Email Link */}
          <div
            style={{
              padding: "20px 32px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              textAlign: "center",
            }}
          >
            <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "14px" }}>
              {t("support.directEmail")}
              <a
                href={`mailto:${supportEmail}`}
                style={{
                  color: "rgba(165, 180, 252, 1)",
                  textDecoration: "none",
                  fontWeight: 600,
                  transition: "color 0.2s ease",
                }}
                onMouseEnter={(e) => e.target.style.color = "rgba(192, 132, 252, 1)"}
                onMouseLeave={(e) => e.target.style.color = "rgba(165, 180, 252, 1)"}
              >
                {supportEmail}
              </a>
            </p>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div variants={fadeInUp}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h2 style={{ color: "#fff", fontSize: "32px", fontWeight: 700, marginBottom: "8px" }}>
              {t("support.faqTitle")}
            </h2>
            <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "16px" }}>
              {t("support.faqSubtitle", { appName })}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {faqItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                style={{
                  backdropFilter: "blur(20px)",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "16px",
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => toggleFAQ(item.id)}
                  style={{
                    width: "100%",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ color: "#fff", fontSize: "16px", fontWeight: 500, paddingRight: "16px" }}>
                    {item.question}
                  </span>
                  <motion.div
                    animate={{ rotate: expandedFAQ === item.id ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ flexShrink: 0 }}
                  >
                    <ChevronDown size={20} color="rgba(255, 255, 255, 0.6)" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {expandedFAQ === item.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{
                        height: "auto",
                        opacity: 1,
                        transition: {
                          height: { duration: 0.3 },
                          opacity: { duration: 0.25, delay: 0.1 },
                        },
                      }}
                      exit={{
                        height: 0,
                        opacity: 0,
                        transition: {
                          height: { duration: 0.25 },
                          opacity: { duration: 0.15 },
                        },
                      }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          padding: "0 24px 20px 24px",
                          color: "rgba(255, 255, 255, 0.7)",
                          fontSize: "15px",
                          lineHeight: 1.6,
                          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                          paddingTop: "16px",
                        }}
                      >
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Support;
