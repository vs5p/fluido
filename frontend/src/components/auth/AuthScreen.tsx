import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  IconBrandGoogleFilled,
  IconMail,
  IconLockFilled,
  IconArrowRight,
  IconUser,
} from "@tabler/icons-react";
import { TrafficLights } from "@/components/ui-mac/TrafficLights";
import {
  onAuth,
  signInGoogle,
  signInEmail,
  signUpEmail,
  firebaseConfigured,
} from "@/lib/firebase";
import { useGame } from "@/store/gameStore";
import { connectSocket, authGoogle } from "@/lib/socket";

export function AuthScreen({ redirectOnSuccess = true }: { redirectOnSuccess?: boolean }) {
  const setUser = useGame((s) => s.setUser);
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [isGoogleSdkLoaded, setIsGoogleSdkLoaded] = useState(false);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Load Google GSI SDK
  useEffect(() => {
    if (!googleClientId) return;
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      if ((window as any).google) setIsGoogleSdkLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setIsGoogleSdkLoaded(true);
    script.onerror = () => console.warn('Google GSI SDK failed to load');
    document.body.appendChild(script);
  }, [googleClientId]);

  // Initialize and render Google Sign-In button
  useEffect(() => {
    if (!isGoogleSdkLoaded || !(window as any).google || !googleClientId) return;

    try {
      (window as any).google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: any) => {
          if (typeof window !== "undefined") {
            localStorage.setItem('orbitdraw-auth-provider', 'google');
          }
          connectSocket();
          authGoogle(response.credential);
        },
      });

      const btnContainer = document.getElementById('google-signin-btn');
      if (btnContainer) {
        (window as any).google.accounts.id.renderButton(
          btnContainer,
          {
            theme: 'filled_black',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            width: 356,
          }
        );
      }
    } catch (err) {
      console.error('Google Sign-In init error:', err);
    }
  }, [isGoogleSdkLoaded, googleClientId]);

  useEffect(() => {
    const unsub = onAuth((u) => {
      setUser(u);
      if (u && redirectOnSuccess) navigate({ to: "/" });
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []); // Run once on mount to subscribe to auth state

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signin") await signInEmail(email, password);
      else await signUpEmail(email, password, nickname);
    } catch (err) {
      const e = err as { message?: string };
      setErr(e.message ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex items-center justify-center p-4"
      style={{ height: "100dvh", background: "var(--bg-base)" }}
    >
        <div
        className="mac-panel w-full max-w-[420px] overflow-hidden anim-fade-in-scale"
      >
        <div
          className="flex items-center"
          style={{ borderBottom: "1px solid var(--separator)" }}
        >
          <TrafficLights />
          <div className="flex-1 text-center text-[12px] text-tertiary-mac py-2">
            Scribble
          </div>
          <div style={{ width: 56 }} />
        </div>

        <div className="px-8 pt-8 pb-7">
          <h1
            className="text-[28px] font-light tracking-tight text-primary-mac mb-1"
            style={{ letterSpacing: "-0.02em" }}
          >
            Welcome back
          </h1>
          <p className="text-[13px] text-secondary-mac mb-7">
            Sign in to start drawing with friends.
          </p>

          {window.location.hostname !== "localhost" && /^[0-9.]+$/.test(window.location.hostname) && (
            <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed text-yellow-400 bg-yellow-400/10 border border-yellow-400/20">
              ⚠️ <strong>Google Auth Note:</strong> Google Sign-In is blocked on private IP addresses (like {window.location.hostname}) by Google security policies. Please use Guest Login for mobile device testing, or set up a tunnel (e.g. ngrok/localtunnel).
            </div>
          )}

          {googleClientId ? (
            <div id="google-signin-btn" className="w-full flex justify-center mb-3" style={{ minHeight: 40 }} />
          ) : (
            <button
              onClick={() => signInGoogle()}
              className="mac-btn w-full justify-center mb-3"
              style={{ minHeight: 40 }}
            >
              <IconBrandGoogleFilled size={16} />
              Continue with Google (Demo)
            </button>
          )}

          <div className="flex items-center gap-3 my-5">
            <div
              className="flex-1 h-px"
              style={{ background: "var(--separator)" }}
            />
            <span className="text-[11px] text-tertiary-mac uppercase tracking-wider">
              or
            </span>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--separator)" }}
            />
          </div>

          <form onSubmit={handleEmail} className="space-y-2.5">
            {mode === "signup" && (
              <div className="relative">
                <IconUser
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-tertiary)" }}
                />
                <input
                  type="text"
                  required
                  placeholder="Nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="mac-input"
                  style={{ paddingLeft: 32 }}
                />
              </div>
            )}
            <div className="relative">
              <IconMail
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-tertiary)" }}
              />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mac-input"
                style={{ paddingLeft: 32 }}
              />
            </div>
            <div className="relative">
              <IconLockFilled
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-tertiary)" }}
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mac-input"
                style={{ paddingLeft: 32 }}
              />
            </div>

            {err ? (
              <p className="text-[12px]" style={{ color: "var(--red)" }}>
                {err}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mac-btn mac-btn-primary w-full justify-center"
              style={{ minHeight: 40, marginTop: 8 }}
            >
              {mode === "signin" ? "Sign in" : "Create account"}
              <IconArrowRight size={14} />
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-[12px] text-secondary-mac hover:text-primary-mac transition-colors"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>

          {!firebaseConfigured && (
            <p className="mt-5 text-[11px] text-tertiary-mac text-center leading-relaxed">
              Demo mode — Firebase keys not configured.
              <br /> Any email/password will sign you in locally.
            </p>
          )}
        </div>
        </div>
    </div>
  );
}
