/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "../lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { logStaffAction } from "../lib/logger";

export default function AuthView({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "user" | "staff" | "admin";
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [user, setUser] = useState<any>(auth.currentUser);
  const [roleChecked, setRoleChecked] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const isRegisteringRef = useRef(false);

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setRoleChecked(false);
      if (u) {
        // Enforce requiredRole
        let isAllowed = true;
        let finalRole = "";
        let isApproved = true;

        try {
          const userDoc = await getDoc(doc(db, "users", u.uid));
          if (userDoc.exists()) {
            finalRole = userDoc.data().role;
            // Existing users without status are assumed approved
            isApproved = userDoc.data().status === "approved" || userDoc.data().status === undefined;
          } else {
            // If user document doesn't exist, try to infer role and create it
            let inferredRole = "user";
            let inferredStatus = "pending";
            if (
              u.email === "jaikladigital@gmail.com" ||
              u.email === "admin@jaikladigital.com"
            ) {
              inferredRole = "admin";
              inferredStatus = "approved";
            } else if (u.email?.endsWith("@jaikladigital.com")) {
              inferredRole = "staff";
              inferredStatus = "approved";
            }
            finalRole = inferredRole;
            isApproved = inferredStatus === "approved";
            // Only create if we are not actively registering (registration handles it differently)
            if (!isRegisteringRef.current) {
              await setDoc(doc(db, "users", u.uid), {
                email: u.email,
                role: inferredRole,
                status: inferredStatus,
                createdAt: new Date().toISOString(),
              });
            }
          }
        } catch (e) {
          console.error("Error checking role:", e);
        }

        if (!isApproved) {
          await logStaffAction("LOGIN_ATTEMPT_BLOCKED", `Login attempt blocked: account is pending approval (Email: ${u.email})`);
          await signOut(auth);
          setError("แอคเค้าท์ของคุณกำลังรอการอนุมัติจากผู้ดูแลระบบ (Pending Admin Approval)");
          setUser(null);
          setIsLoading(false);
          setRoleChecked(false);
          return;
        }

        if (requiredRole === "admin") {
          let isAdminEmail =
            u.email === "jaikladigital@gmail.com" ||
            u.email === "admin@jaikladigital.com";
          if (!isAdminEmail && finalRole !== "admin") {
            isAllowed = false;
          }
          if (u.email?.endsWith("@jaikladigital.com") && !isAdminEmail) {
            isAllowed = false; // Strictly prevent staff from being admins even if DB got messed up
          }
        } else if (requiredRole === "staff") {
          let isStaffEmail = u.email?.endsWith("@jaikladigital.com");
          if (!isStaffEmail && finalRole !== "admin" && finalRole !== "staff") {
            isAllowed = false;
          }
        } else if (requiredRole === "user") {
          if (
            finalRole !== "admin" &&
            finalRole !== "staff" &&
            finalRole !== "user"
          ) {
            isAllowed = false;
          }
        }

        if (!isAllowed && !isRegisteringRef.current) {
          await logStaffAction("LOGIN_ATTEMPT_DENIED", `Login attempt denied: insufficient permissions for required role ${requiredRole} (Email: ${u.email})`);
          await signOut(auth);
          setError(
            `Account does not have required permissions (${requiredRole} only).`,
          );
          setUser(null);
          setRoleChecked(false);
          return;
        }

        setIsLoading(false);
        setUser(u);
        setRoleChecked(true);
      } else {
        setUser(null);
        setIsLoading(false);
        setRoleChecked(false);
      }
    });
    return unsubscribe;
  }, [requiredRole]);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      if (isRegistering) {
        isRegisteringRef.current = true;
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        // Let's set the basic data in firestore users collection
        if (userCredential.user) {
          await logStaffAction("STAFF_REGISTER", `Registered new account successfully (Email: ${userCredential.user.email})`);
          try {
            let inferredRole = "user";
            let inferredStatus = "pending";
            const newEmail = userCredential.user.email;
            if (
              newEmail === "jaikladigital@gmail.com" ||
              newEmail === "admin@jaikladigital.com"
            ) {
              inferredRole = "admin";
              inferredStatus = "approved";
            } else if (newEmail?.endsWith("@jaikladigital.com")) {
              inferredRole = "staff";
              inferredStatus = "approved";
            }
            await setDoc(doc(db, "users", userCredential.user.uid), {
              email: userCredential.user.email,
              role: inferredRole, // Enforced based on email domain
              status: inferredStatus,
              createdAt: new Date().toISOString(),
            });

            if (inferredStatus === "pending") {
              try {
                const configDoc = await getDoc(doc(db, "settings", "config"));
                if (configDoc.exists()) {
                  const configData = configDoc.data();
                  if (configData.lineNotifyEnabled && configData.lineChannelId && configData.lineChannelSecret) {
                    const { sendNotification } = await import("../utils/notify");
                    await sendNotification("line_messaging_api", {
                      message: `🔔 มีผู้สมัครสมาชิกใหม่: ${newEmail}\nกรุณาเข้าสู่ระบบแอดมินเพื่อตรวจสอบและอนุมัติ`,
                      channelId: configData.lineChannelId,
                      channelSecret: configData.lineChannelSecret,
                      targetUserId: configData.lineAdminUserId,
                    });
                  }
                }
              } catch (notifyErr) {
                console.error("Failed to send LINE notification:", notifyErr);
              }
            }
          } catch (err) {
            console.error("Failed to create user doc:", err);
          }
        }
      } else {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        // Explicitly check and create user doc here as fallback
        if (userCredential.user) {
          await logStaffAction("STAFF_LOGIN", `Logged in to system successfully (Email: ${userCredential.user.email})`);
          try {
            const u = userCredential.user;
            const userDoc = await getDoc(doc(db, "users", u.uid));
            if (!userDoc.exists()) {
              let inferredRole = "user";
              let inferredStatus = "pending";
              if (
                u.email === "jaikladigital@gmail.com" ||
                u.email === "admin@jaikladigital.com"
              ) {
                inferredRole = "admin";
                inferredStatus = "approved";
              } else if (u.email?.endsWith("@jaikladigital.com")) {
                inferredRole = "staff";
                inferredStatus = "approved";
              }
              await setDoc(doc(db, "users", u.uid), {
                email: u.email,
                role: inferredRole,
                status: inferredStatus,
                createdAt: new Date().toISOString(),
              });

              if (inferredStatus === "pending") {
                try {
                  const configDoc = await getDoc(doc(db, "settings", "config"));
                  if (configDoc.exists()) {
                    const configData = configDoc.data();
                    if (configData.lineNotifyEnabled && configData.lineChannelId && configData.lineChannelSecret) {
                      const { sendNotification } = await import("../utils/notify");
                      await sendNotification("line_messaging_api", {
                        message: `🔔 มีผู้สมัครสมาชิกใหม่: ${u.email}\nกรุณาเข้าสู่ระบบแอดมินเพื่อตรวจสอบและอนุมัติ`,
                        channelId: configData.lineChannelId,
                        channelSecret: configData.lineChannelSecret,
                        targetUserId: configData.lineAdminUserId,
                      });
                    }
                  }
                } catch (notifyErr) {
                  console.error("Failed to send LINE notification:", notifyErr);
                }
              }
            }
          } catch (e) {
            console.error("Manual doc creation failed:", e);
          }
        }
      }
    } catch (err: any) {
      if (err.code === "auth/email-already-in-use") {
        setError(
          "อีเมลนี้ถูกใช้งานแล้ว ลองทำการ Login ดู (Email already in use. Try logging in.)",
        );
      } else if (
        err.code === "auth/invalid-login-credentials" ||
        err.code === "auth/wrong-password"
      ) {
        setError("รหัสผ่านหรืออีเมลไม่ถูกต้อง");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
      isRegisteringRef.current = false;
    }
  };

  const handleLogout = async () => {
    await logStaffAction("STAFF_LOGOUT", "Logged out of system successfully");
    signOut(auth);
  };

  if (user) {
    if (!roleChecked) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <div className="text-center" id="auth-loading-spinner">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500 mx-auto mb-4" />
            <p className="text-sm text-slate-500 font-medium">กำลังตรวจสอบสิทธิ์ (Verifying permissions...)</p>
          </div>
        </div>
      );
    }
    // Re-verify the user hasn't been logged out by onAuthStateChanged
    if (!auth.currentUser) return null;

    return (
      <div>
        <div className="flex justify-end p-2 border-b border-slate-200">
          <span className="text-sm text-slate-600 mr-4 self-center">
            {user.email}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-rose-500 hover:text-rose-700"
          >
            Logout
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 max-w-sm w-full">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
          {isRegistering
            ? "📝 Register Account"
            : requiredRole === "user"
              ? "📊 ลูกค้าเข้าสู่ระบบ (Client Login)"
              : "🔐 Staff & Admin Login"}
        </h2>
        {error && <p className="text-rose-500 text-sm mb-4">{error}</p>}
        {requiredRole === "admin" && !isRegistering && (
          <p className="text-amber-600 text-xs mb-4 text-center">
            ต้องใช้สิทธิ์แอดมินเท่านั้น
          </p>
        )}
        <form onSubmit={handleAuthAction} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (admin@example.com)"
            className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-bold py-3 rounded-xl transition ${isLoading ? "bg-rose-400 cursor-not-allowed" : "bg-rose-500 hover:bg-rose-600"}`}
          >
            {isLoading ? "Processing..." : isRegistering ? "Register" : "Login"}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            {isRegistering
              ? "Already have an account? Login"
              : "Need an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
