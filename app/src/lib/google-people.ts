const PEOPLE_API_ENDPOINT =
	"https://people.googleapis.com/v1/people/me?personFields=birthdays,photos";

type PeopleDate = {
	day?: number;
	month?: number;
	year?: number;
};

type PeopleBirthday = {
	date?: PeopleDate;
	metadata?: {
		primary?: boolean;
		source?: {
			type?: string;
		};
	};
};

type PeoplePhoto = {
	url?: string;
	metadata?: {
		primary?: boolean;
	};
};

type PeopleResponse = {
	birthdays?: PeopleBirthday[];
	photos?: PeoplePhoto[];
};

export type GoogleProfileDetails = {
	birthday?: {
		day: number;
		month: number;
		year?: number;
	};
	photoUrl?: string;
};

const pickPrimary = <T extends { metadata?: { primary?: boolean } }>(
	values: T[] | undefined,
): T | undefined => {
	if (!values?.length) {
		return undefined;
	}
	const primary = values.find((item) => item.metadata?.primary);
	return primary ?? values[0];
};

const parseBirthday = (
	birthday?: PeopleBirthday,
): GoogleProfileDetails["birthday"] => {
	const date = birthday?.date;
	if (!date?.day || !date?.month) {
		return undefined;
	}

	return {
		day: date.day,
		month: date.month,
		year: date.year,
	};
};

export async function fetchGoogleProfileDetails(
	accessToken: string,
): Promise<GoogleProfileDetails | null> {
	if (!accessToken) {
		return null;
	}

	const response = await fetch(PEOPLE_API_ENDPOINT, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
		cache: "no-store",
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Failed to fetch Google profile details (${response.status}): ${body}`,
		);
	}

	const payload = (await response.json()) as PeopleResponse;

	const birthday = parseBirthday(pickPrimary(payload.birthdays));
	const photoUrl = pickPrimary(payload.photos)?.url;

	if (!birthday && !photoUrl) {
		return null;
	}

	return {
		birthday,
		photoUrl: photoUrl ?? undefined,
	};
}
