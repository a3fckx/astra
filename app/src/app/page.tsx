import { headers } from "next/headers";
import { GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { VoiceSession } from "@/components/voice-session";
import { auth } from "@/lib/auth";
import { elevenlabsEnv } from "@/lib/elevenlabs";

export default async function LandingPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
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
						Astra
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

				<GoogleSignInButton />
			</main>
		);
	}

	const agentId = elevenlabsEnv.agentId;
	if (!agentId) {
		return (
			<main
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "100vh",
					padding: "2rem",
					gap: "1rem",
				}}
			>
				<p style={{ color: "red" }}>ElevenLabs Agent ID not configured</p>
				<SignOutButton />
			</main>
		);
	}

	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				minHeight: "100vh",
				padding: "2rem",
				gap: "2rem",
			}}
		>
			<VoiceSession agentId={agentId} />
			<SignOutButton />
		</main>
	);
}
