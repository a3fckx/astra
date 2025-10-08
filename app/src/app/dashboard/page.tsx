import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ResponderConsole } from "@/components/responder-console";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
	title: "Astra Dashboard",
};

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/");
	}

	return (
		<main
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "1.5rem",
				padding: "3.5rem 2.5rem",
				maxWidth: "1200px",
				margin: "0 auto",
			}}
		>
			<header
				style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
			>
				<h1 style={{ fontSize: "2.25rem", margin: 0 }}>
					Welcome back, {session.user.name ?? session.user.email}
				</h1>
				<p style={{ opacity: 0.7, maxWidth: "720px" }}>
					This dashboard exposes the Better Auth powered identity surface and a
					single responder stream from the Python agent mesh. Background
					specialists stay private in the monolith.
				</p>
			</header>
			<ResponderConsole userId={session.user.id} />
		</main>
	);
}
