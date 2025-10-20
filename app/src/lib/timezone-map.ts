type TimezoneMap = Record<string, string>;

const COUNTRY_TIMEZONE_MAP: TimezoneMap = {
	india: "Asia/Kolkata",
	"united states": "America/New_York",
	usa: "America/New_York",
	"united kingdom": "Europe/London",
	uk: "Europe/London",
	england: "Europe/London",
	scotland: "Europe/London",
	wales: "Europe/London",
	ireland: "Europe/Dublin",
	canada: "America/Toronto",
	australia: "Australia/Sydney",
	new_zealand: "Pacific/Auckland",
	singapore: "Asia/Singapore",
	malaysia: "Asia/Kuala_Lumpur",
	united_arab_emirates: "Asia/Dubai",
	uae: "Asia/Dubai",
	qatar: "Asia/Qatar",
	saudi_arabia: "Asia/Riyadh",
	germany: "Europe/Berlin",
	france: "Europe/Paris",
	spain: "Europe/Madrid",
	italy: "Europe/Rome",
	netherlands: "Europe/Amsterdam",
	sweden: "Europe/Stockholm",
	norway: "Europe/Oslo",
	denmark: "Europe/Copenhagen",
	switzerland: "Europe/Zurich",
	portugal: "Europe/Lisbon",
	belgium: "Europe/Brussels",
	austria: "Europe/Vienna",
	turkey: "Europe/Istanbul",
	south_africa: "Africa/Johannesburg",
	nigeria: "Africa/Lagos",
	kenya: "Africa/Nairobi",
	brazil: "America/Sao_Paulo",
	argentina: "America/Argentina/Buenos_Aires",
	mexico: "America/Mexico_City",
	japan: "Asia/Tokyo",
	south_korea: "Asia/Seoul",
	china: "Asia/Shanghai",
	hong_kong: "Asia/Hong_Kong",
	taiwan: "Asia/Taipei",
	thailand: "Asia/Bangkok",
	vietnam: "Asia/Ho_Chi_Minh",
	indonesia: "Asia/Jakarta",
	philippines: "Asia/Manila",
};

const normalizeKey = (input: string) =>
	input
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ")
		.replace(/[^a-z\s]/g, "")
		.replace(/\s/g, "_");

/**
 * Resolve a primary timezone for a given country/region name.
 * Returns null when no mapping is available.
 */
export const resolveTimezoneForCountry = (
	country?: string | null,
): string | null => {
	if (!country) {
		return null;
	}
	const key = normalizeKey(country);
	return COUNTRY_TIMEZONE_MAP[key] ?? null;
};
