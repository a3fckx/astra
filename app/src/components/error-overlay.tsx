"use client";

type ErrorOverlayProps = {
	error: string | null;
	fallbackMessage?: string | null;
	onRetry?: (() => void) | null;
	retryLabel?: string;
};

export function ErrorOverlay({
	error,
	fallbackMessage,
	onRetry,
	retryLabel,
}: ErrorOverlayProps) {
	if (!error && !fallbackMessage) {
		return null;
	}

	const content = error ?? fallbackMessage;
	if (!content) {
		return null;
	}

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 10,
				pointerEvents: "none",
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				padding: "1.5rem",
				borderRadius: "inherit",
				background: "rgba(255,255,255,0.85)",
				backdropFilter: "blur(16px)",
			}}
		>
			<div
				style={{
					maxWidth: "420px",
					width: "100%",
					borderRadius: "1rem",
					background: "rgba(255,255,255,0.95)",
					padding: "1.5rem",
					fontSize: "1.05rem",
					fontWeight: 500,
					color: "#1f2937",
					pointerEvents: "auto",
					boxShadow: "0 20px 44px rgba(15, 23, 42, 0.18)",
					textAlign: "center",
				}}
			>
				<div>{content}</div>
				{error && onRetry ? (
					<button
						type="button"
						onClick={onRetry}
						style={{
							marginTop: "1.25rem",
							borderRadius: "0.75rem",
							background: "#0f172a",
							color: "#f8fafc",
							padding: "0.65rem 1.5rem",
							fontSize: "0.95rem",
							fontWeight: 600,
							border: "none",
							cursor: "pointer",
						}}
					>
						{retryLabel ?? "Restart chat"}
					</button>
				) : null}
			</div>
		</div>
	);
}
