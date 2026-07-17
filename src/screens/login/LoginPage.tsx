"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import "./LoginPage.css";
import { login } from "@/services/authService";
import { saveSession } from "@/services/session";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@risansi\.com$/;
const MIN_PASSWORD_LENGTH = 6;

const errorMessage = (err: unknown, fallback: string): string => {
  const response = (err as { response?: { data?: { error?: string } } })?.response;
  return response?.data?.error ?? fallback;
};

const LoginPage = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    let valid = true;
    const trimmedEmail = email.trim();

    setEmailError("");
    setPasswordError("");
    setFormError("");

    if (!trimmedEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      setEmailError("Please enter a valid @risansi.com email.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      valid = false;
    }

    return valid;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      saveSession(result.token, result.user);
      router.push("/dashboard");
    } catch (err) {
      setFormError(errorMessage(err, "Unable to sign in. Please try again."));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="branding-panel">
        <div className="branding-content">
          <img src="/logo.png" alt="Risansi Industries" className="company-logo" />

          <h1>
            Pump Testing
            <br />
            Portal
          </h1>

          <p>
            Requisition intake, dedup checks against prior test reports, and
            test report submission for the R&amp;D / production testing team.
          </p>

          <span>Version 2.0</span>
        </div>
      </div>

      <div className="login-form-container">
        <form onSubmit={handleLogin} noValidate>
          <h2>Sign In</h2>
          <p>Login with your company credentials</p>

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}

          <label htmlFor="email">Company Email</label>
          <input
            id="email"
            type="email"
            placeholder="you@risansi.com"
            value={email}
            autoComplete="username"
            aria-invalid={!!emailError}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError("");
              if (formError) setFormError("");
            }}
          />
          {emailError && (
            <span className="error-text" role="alert">
              {emailError}
            </span>
          )}

          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              autoComplete="current-password"
              aria-invalid={!!passwordError}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
                if (formError) setFormError("");
              }}
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {passwordError && (
            <span className="error-text" role="alert">
              {passwordError}
            </span>
          )}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

          <p className="request-access-note">
            Need access? Request an account through the Sales Portal — the
            same login works here once approved.
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
