'use client';

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "@/lib/axiosConfig";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiConfig";
import { motion } from "framer-motion";
import { Mail, Lock, User, Phone, Eye, EyeOff } from "lucide-react";

function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [focusedField, setFocusedField] = useState(null);

  const router = useRouter();
  const { t } = useTranslation();

  const [countryCode, setCountryCode] = useState("+82");
  const [agreeCollect, setAgreeCollect] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [agreePhone, setAgreePhone] = useState(false);

  const formatPhoneDigits = (value) => {
    return value.replace(/\D/g, "").slice(0, 11);
  };

  const handlePhoneChange = (e) => {
    setPhone(formatPhoneDigits(e.target.value));
  };

  const toNationalNumber = (cc, digits) => {
    if (!digits) return "";
    if (cc === "+82" && digits.startsWith("0")) {
      return digits.replace(/^0+/, "");
    }
    return digits;
  };

  const getFullPhone = () => {
    const national = toNationalNumber(countryCode, phone);
    if (!national) return null;
    return `(${countryCode})${national}`;
  };

  const isPhoneValid = (value) => {
    if (!value) return true;
    if (!/^\d{9,11}$/.test(value)) return false;
    const national = toNationalNumber(countryCode, value);
    return /^\d{8,11}$/.test(national);
  };

  const isEmailValid = (value) => {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value);
  };

  const failDetail = (data) => {
    if (!data) return t("signup.serverError");
    return data.message || data.code || t("login.unknownError");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedUsername = (username || "").trim();
    const trimmedEmail = (email || "").trim().replace(/\s/g, "");

    if (!trimmedUsername || trimmedUsername.length < 2 || trimmedUsername.length > 50) {
      alert(t("signup.nameMinLength"));
      return;
    }

    if (!isEmailValid(trimmedEmail)) {
      alert(t("signup.invalidEmail"));
      return;
    }

    if (password1 !== password2) {
      alert(t("signup.passwordMismatch"));
      return;
    }

    if (phone && !isPhoneValid(phone)) {
      alert(t("signup.invalidPhone"));
      return;
    }

    if (!agreeCollect || !agreeAge || !agreePolicy) {
      alert(t("signup.needConsent"));
      return;
    }

    if (phone && !agreePhone) {
      alert(t("signup.needPhoneConsent"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await axios.post("/api/v1/user/register", {
        username: trimmedUsername,
        password: password1,
        email: trimmedEmail,
        phone: agreePhone ? getFullPhone() : null,
        privacyConsent: true,
      });

      if (response.data.success) {
        alert(t("signup.signupComplete"));
        const base = getApiBaseUrl() || window.location.origin;
        const url = base.startsWith("http") ? `${base.replace(/\/$/, "")}/login` : "/login";
        window.location.replace(url);
      } else {
        alert(t("signup.signupFailed") + failDetail(response.data));
      }
    } catch (error) {
      console.error("register failed:", error);
      if (error.response && error.response.data) {
        alert(t("signup.signupFailed") + failDetail(error.response.data));
      } else {
        alert(t("signup.signupFailed") + t("signup.serverError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputStyle = (fieldName) => ({
    background: 'rgba(255, 255, 255, 0.05)',
    border: focusedField === fieldName 
      ? '1px solid rgba(139, 92, 246, 0.5)' 
      : '1px solid rgba(255, 255, 255, 0.1)',
    color: '#f5f7ff',
    boxShadow: focusedField === fieldName ? '0 0 20px rgba(139, 92, 246, 0.15)' : 'none',
  });

  const getIconColor = (fieldName) => focusedField === fieldName ? '#8b5cf6' : '#71717a';

  const requiredConsentOk = agreeCollect && agreeAge && agreePolicy;
  const checkboxLabelStyle = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    fontSize: 13,
    lineHeight: 1.5,
    color: '#e4e4e7',
    cursor: 'pointer',
  };
  const checkboxStyle = {
    width: 18,
    height: 18,
    marginTop: 2,
    flexShrink: 0,
    accentColor: '#8b5cf6',
    cursor: 'pointer',
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: '#09090b' }}>
      
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute rounded-full"
          style={{
            top: '-25%',
            right: '-25%',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, -100, 0],
            y: [0, 50, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            bottom: '-25%',
            left: '-25%',
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            top: '50%',
            left: '50%',
            width: '20rem',
            height: '20rem',
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* Glassmorphism Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-md z-10"
      >
        <div 
          className="relative rounded-3xl p-8 shadow-2xl"
          style={{
            background: 'rgba(17, 19, 24, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Gradient Border Effect */}
          <div 
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, transparent 50%, rgba(59, 130, 246, 0.15) 100%)',
            }}
          />
          
          <div className="relative z-10">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-6"
            >
              <h1 
                className="text-2xl font-bold mb-2"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {t("signup.title")}
              </h1>
              <p style={{ color: '#a1a1aa', fontSize: '14px' }}>
                {t("signup.subtitle")}
              </p>
            </motion.div>

            {/* Signup Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-2"
              >
                <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>
                  {t("signup.email")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <Mail size={18} style={{ color: getIconColor('email'), transition: 'color 0.2s' }} />
                  </div>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    required
                    className="w-full h-11 pl-11 pr-4 rounded-xl outline-none transition-all duration-200"
                    style={getInputStyle('email')}
                  />
                </div>
              </motion.div>

              {/* Password Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="space-y-2"
              >
                <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>
                  {t("signup.password")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <Lock size={18} style={{ color: getIconColor('password1'), transition: 'color 0.2s' }} />
                  </div>
                  <input
                    type={showPassword1 ? 'text' : 'password'}
                    placeholder={t("signup.passwordPlaceholder")}
                    value={password1}
                    onChange={(e) => setPassword1(e.target.value)}
                    onFocus={() => setFocusedField('password1')}
                    onBlur={() => setFocusedField(null)}
                    required
                    className="w-full h-11 pl-11 pr-11 rounded-xl outline-none transition-all duration-200"
                    style={getInputStyle('password1')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword1(!showPassword1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                    style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showPassword1 ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </motion.div>

              {/* Password Confirm Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-2"
              >
                <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>
                  {t("signup.confirmPassword")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <Lock size={18} style={{ color: getIconColor('password2'), transition: 'color 0.2s' }} />
                  </div>
                  <input
                    type={showPassword2 ? 'text' : 'password'}
                    placeholder={t("signup.confirmPasswordPlaceholder")}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    onFocus={() => setFocusedField('password2')}
                    onBlur={() => setFocusedField(null)}
                    required
                    className="w-full h-11 pl-11 pr-11 rounded-xl outline-none transition-all duration-200"
                    style={getInputStyle('password2')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                    style={{ color: '#71717a', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {showPassword2 ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </motion.div>

              {/* Username Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45 }}
                className="space-y-2"
              >
                <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>
                  {t("signup.username")}
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
                    <User size={18} style={{ color: getIconColor('username'), transition: 'color 0.2s' }} />
                  </div>
                  <input
                    type="text"
                    placeholder={t("signup.username")}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    required
                    maxLength={50}
                    className="w-full h-11 pl-11 pr-4 rounded-xl outline-none transition-all duration-200"
                    style={getInputStyle('username')}
                  />
                </div>
              </motion.div>

              {/* Phone Input */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="space-y-2"
              >
                <label style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>
                  {t("signup.phone")} <span style={{ color: '#71717a', fontWeight: 400 }}>{t("signup.phoneOptional")}</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative" style={{ width: '110px', flexShrink: 0 }}>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
                      <Phone size={18} style={{ color: getIconColor('phone'), transition: 'color 0.2s' }} />
                    </div>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-full h-11 pl-9 pr-2 rounded-xl outline-none transition-all duration-200 appearance-none cursor-pointer"
                      style={{
                        ...getInputStyle('phone'),
                        fontSize: '14px',
                      }}
                    >
                      <option value="+82">+82</option>
                      <option value="+1">+1</option>
                      <option value="+81">+81</option>
                      <option value="+86">+86</option>
                      <option value="+44">+44</option>
                      <option value="+61">+61</option>
                    </select>
                  </div>
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="01012345678"
                      maxLength={11}
                      value={phone}
                      onChange={handlePhoneChange}
                      onFocus={() => setFocusedField('phone')}
                      onBlur={() => setFocusedField(null)}
                      className="w-full h-11 px-4 rounded-xl outline-none transition-all duration-200"
                      style={getInputStyle('phone')}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Privacy consent — ONE Store / PIPA: notice + unchecked checkboxes */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.52 }}
                className="space-y-3"
              >
                <div
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: 'rgba(0,0,0,0.25)',
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: '#d4d4d8',
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#fafafa', fontSize: 13 }}>
                    {t("signup.consentTitle")}
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <strong style={{ color: '#fde68a' }}>{t("signup.consentRequiredBadge")}</strong>{' '}
                    {t("signup.noticeRequiredItems")}
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>{t("signup.noticePurposeLabel")}</strong> {t("signup.noticePurpose")}
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <strong>{t("signup.noticeRetentionLabel")}</strong> {t("signup.noticeRetention")}
                  </p>
                  <p style={{ margin: '0 0 6px' }}>
                    <strong style={{ color: '#a1a1aa' }}>{t("signup.consentOptionalBadge")}</strong>{' '}
                    {t("signup.noticeOptionalItems")}
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>{t("signup.noticeRefuseLabel")}</strong> {t("signup.noticeRefuse")}
                  </p>
                </div>

                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={agreeCollect}
                    onChange={(e) => setAgreeCollect(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <span>{t("signup.agreeCollect")}</span>
                </label>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={agreeAge}
                    onChange={(e) => setAgreeAge(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <span>{t("signup.agreeAge")}</span>
                </label>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={agreePolicy}
                    onChange={(e) => setAgreePolicy(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <span>
                    {t("signup.agreePolicy")}{' '}
                    <a
                      href="/privacy-policy.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#a78bfa', textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t("signup.policyLink")}
                    </a>
                  </span>
                </label>
                <label style={checkboxLabelStyle}>
                  <input
                    type="checkbox"
                    checked={agreePhone}
                    onChange={(e) => setAgreePhone(e.target.checked)}
                    style={checkboxStyle}
                  />
                  <span>{t("signup.agreePhone")}</span>
                </label>
              </motion.div>

              {/* Submit Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="pt-2"
              >
                <button
                  type="submit"
                  disabled={isSubmitting || !requiredConsentOk}
                  className="w-full h-12 rounded-xl font-semibold transition-all duration-300"
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
                    color: '#fff',
                    border: 'none',
                    cursor: isSubmitting || !requiredConsentOk ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting || !requiredConsentOk ? 0.6 : 1,
                    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
                  }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {t("signup.processing")}
                    </span>
                  ) : (
                    t("signup.signupBtn")
                  )}
                </button>
              </motion.div>
            </form>

            {/* Login Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 text-center"
              style={{ fontSize: '14px', color: '#71717a' }}
            >
              {t("signup.hasAccount")}{' '}
              <button
                type="button"
                onClick={() => router.push("/login")}
                style={{
                  color: '#8b5cf6',
                  fontWeight: 600,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t("signup.login")}
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Signup;
