"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function GoogleSignInButton() {
	const [loading, setLoading] = useState(false);

	const handleClick = async () => {
		try {
			setLoading(true);
			await authClient.signIn.social({
				provider: "google",
				callbackURL: "/",
			});
		} catch (error) {
			console.error("Google sign-in failed", error);
		} finally {
			setLoading(false);
		}
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={loading}
			style={{
				padding: "0.75rem 1.5rem",
				borderRadius: "0.75rem",
				fontSize: "1rem",
				fontWeight: 600,
				background: "linear-gradient(135deg,#fbbc04,#ea4335)",
				color: "#0f0f10",
				border: "none",
				cursor: loading ? "not-allowed" : "pointer",
				boxShadow: "0 10px 30px rgba(250, 180, 4, 0.35)",
				transition: "transform 120ms ease, box-shadow 120ms ease",
			}}
		>
			{loading ? "Connecting…" : "Continue with Google"}
		</button>
	);
}

export function SignOutButton() {
	const [loading, setLoading] = useState(false);

	const handleSignOut = async () => {
		try {
			setLoading(true);
			await authClient.signOut();
		} catch (error) {
			console.error("Sign out failed", error);
		} finally {
			setLoading(false);
			window.location.href = "/";
		}
	};

	return (
		<button
			type="button"
			onClick={handleSignOut}
			disabled={loading}
			style={{
				padding: "0.65rem 1.5rem",
				borderRadius: "0.75rem",
				fontSize: "0.95rem",
				fontWeight: 600,
				background: "rgba(231,233,238,0.08)",
				color: "#e7e9ee",
				border: "1px solid rgba(231,233,238,0.24)",
				cursor: loading ? "not-allowed" : "pointer",
				transition: "background 120ms ease, color 120ms ease",
			}}
		>
			{loading ? "Signing out…" : "Sign out"}
		</button>
	);
}
