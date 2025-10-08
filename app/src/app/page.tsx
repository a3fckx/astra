import { headers } from "next/headers";
import Link from "next/link";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { auth } from "@/lib/auth";

export default async function LandingPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				gap: "1.75rem",
				padding: "8rem 1.5rem 6rem",
				textAlign: "center",
			}}
		>
			<div style={{ maxWidth: "720px" }}>
				<p
					style={{
						fontSize: "0.95rem",
						letterSpacing: "0.3em",
						textTransform: "uppercase",
						opacity: 0.65,
					}}
				>
					Astra {/* Conversational Agents */}
				</p>
				<h1
					style={{
						fontSize: "3rem",
						lineHeight: 1.1,
						margin: "1rem 0",
						fontWeight: 700,
					}}
				>
					Unified identity + background agent orchestration
				</h1>
				<p
					style={{
						fontSize: "1.15rem",
						opacity: 0.75,
						lineHeight: 1.6,
					}}
				>
					Sign in with Google to access your personalized responders, manage
					scopes, and synchronize with Julep-managed agents. Better Auth keeps
					sessions secure while background tasks handle voice intelligence.
				</p>
			</div>

			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: "1rem",
					justifyContent: "center",
				}}
			>
				{session ? (
					<>
						<Link
							href="/dashboard"
							style={{
								padding: "0.75rem 1.75rem",
								borderRadius: "0.75rem",
								background: "rgba(231,233,238,0.12)",
								color: "#e7e9ee",
								border: "1px solid rgba(231,233,238,0.24)",
								fontWeight: 600,
							}}
						>
							Open dashboard
						</Link>
						<SignOutButton />
					</>
				) : (
					<GoogleSignInButton />
				)}
			</div>

			{session && (
				<p style={{ fontSize: "0.95rem", opacity: 0.7 }}>
					Signed in as <strong>{session.user.email}</strong>
				</p>
			)}
		</main>
	);
}
