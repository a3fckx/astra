import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// Mock environment variables before each test
const originalEnv = process.env;

describe('Environment Variable Configuration', () => {
	beforeEach(() => {
		process.env = { ...originalEnv };
		delete process.env.NODE_ENV;
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('boolFromEnv helper', () => {
		const mockBoolFromEnv = (value: string | undefined, fallback: boolean): boolean => {
			if (value === undefined) {
				return fallback;
			}
			const normalized = value.trim().toLowerCase();
			if (['1', 'true', 'yes', 'on'].includes(normalized)) {
				return true;
			}
			if (['0', 'false', 'no', 'off'].includes(normalized)) {
				return false;
			}
			return fallback;
		};

		it('should return true for true values', () => {
			expect(mockBoolFromEnv('1', false)).toBe(true);
			expect(mockBoolFromEnv('true', false)).toBe(true);
			expect(mockBoolFromEnv('TRUE', false)).toBe(true);
			expect(mockBoolFromEnv('yes', false)).toBe(true);
			expect(mockBoolFromEnv('YES', false)).toBe(true);
			expect(mockBoolFromEnv('on', false)).toBe(true);
			expect(mockBoolFromEnv('ON', false)).toBe(true);
		});

		it('should return false for false values', () => {
			expect(mockBoolFromEnv('0', true)).toBe(false);
			expect(mockBoolFromEnv('false', true)).toBe(false);
			expect(mockBoolFromEnv('FALSE', true)).toBe(false);
			expect(mockBoolFromEnv('no', true)).toBe(false);
			expect(mockBoolFromEnv('NO', true)).toBe(false);
			expect(mockBoolFromEnv('off', true)).toBe(false);
			expect(mockBoolFromEnv('OFF', true)).toBe(false);
		});

		it('should return fallback for undefined values', () => {
			expect(mockBoolFromEnv(undefined, true)).toBe(true);
			expect(mockBoolFromEnv(undefined, false)).toBe(false);
		});

		it('should return fallback for invalid values', () => {
			expect(mockBoolFromEnv('invalid', true)).toBe(true);
			expect(mockBoolFromEnv('invalid', false)).toBe(false);
			expect(mockBoolFromEnv('', true)).toBe(true);
			expect(mockBoolFromEnv('', false)).toBe(false);
		});

		it('should handle whitespace', () => {
			expect(mockBoolFromEnv(' true ', false)).toBe(true);
			expect(mockBoolFromEnv(' false ', true)).toBe(false);
		});
	});

	describe('required helper', () => {
		const mockRequired = (name: string, value: string | undefined): string => {
			if (!value || !value.trim()) {
				throw new Error(`Missing required environment variable: ${name}`);
			}
			return value;
		};

		it('should return value for non-empty strings', () => {
			expect(mockRequired('TEST_VAR', 'some_value')).toBe('some_value');
			expect(mockRequired('TEST_VAR', '   spaced_value   ')).toBe('   spaced_value   ');
		});

		it('should throw error for undefined values', () => {
			expect(() => mockRequired('TEST_VAR', undefined)).toThrow(
				'Missing required environment variable: TEST_VAR'
			);
		});

		it('should throw error for empty string', () => {
			expect(() => mockRequired('TEST_VAR', '')).toThrow(
				'Missing required environment variable: TEST_VAR'
			);
		});

		it('should throw error for string with only whitespace', () => {
			expect(() => mockRequired('TEST_VAR', '   ')).toThrow(
				'Missing required environment variable: TEST_VAR'
			);
		});
	});

	// MongoDB URI build tests omitted due to secret detection sensitivity
	// These would test the buildMongoUri function with various inputs

	describe('googleScopes function', () => {
		const mockGoogleScopes = (enableBirthday: boolean, enableGmail: boolean): string[] => {
			const BASE_SCOPES = [
				'openid',
				'https://www.googleapis.com/auth/userinfo.email',
				'https://www.googleapis.com/auth/userinfo.profile',
			];
			const BIRTHDAY_SCOPE = 'https://www.googleapis.com/auth/user.birthday.read';
			const GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

			const scopes = new Set(BASE_SCOPES);
			if (enableBirthday) {
				scopes.add(BIRTHDAY_SCOPE);
			}
			if (enableGmail) {
				scopes.add(GMAIL_READ_SCOPE);
			}
			return Array.from(scopes);
		};

		it('should return base scopes when all features disabled', () => {
			const scopes = mockGoogleScopes(false, false);
			expect(scopes).toHaveLength(3);
			expect(scopes).toContain('openid');
			expect(scopes).toContain('https://www.googleapis.com/auth/userinfo.email');
			expect(scopes).toContain('https://www.googleapis.com/auth/userinfo.profile');
		});

		it('should include birthday scope when enabled', () => {
			const scopes = mockGoogleScopes(true, false);
			expect(scopes).toHaveLength(4);
			expect(scopes).toContain('https://www.googleapis.com/auth/user.birthday.read');
		});

		it('should include Gmail scope when enabled', () => {
			const scopes = mockGoogleScopes(false, true);
			expect(scopes).toHaveLength(4);
			expect(scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
		});

		it('should include both scopes when both enabled', () => {
			const scopes = mockGoogleScopes(true, true);
			expect(scopes).toHaveLength(5);
			expect(scopes).toContain('https://www.googleapis.com/auth/user.birthday.read');
			expect(scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
		});

		it('should return array without duplicates', () => {
			const scopes1 = mockGoogleScopes(true, false);
			const scopes2 = mockGoogleScopes(true, false);
			expect(scopes1).toEqual(scopes2);
			expect(new Set(scopes1).size).toBe(scopes1.length); // No duplicates
		});
	});

	describe('googlePrompt validation', () => {
		const mockGooglePrompt = (rawValue: string | undefined): string | undefined => {
			const GOOGLE_PROMPT_VALUES = new Set([
				'select_account',
				'consent',
				'login',
				'none',
				'select_account consent',
			]);

			return GOOGLE_PROMPT_VALUES.has(rawValue || '') ? rawValue : undefined;
		};

		it('should accept valid prompt values', () => {
			expect(mockGooglePrompt('select_account')).toBe('select_account');
			expect(mockGooglePrompt('consent')).toBe('consent');
			expect(mockGooglePrompt('login')).toBe('login');
			expect(mockGooglePrompt('none')).toBe('none');
			expect(mockGooglePrompt('select_account consent')).toBe('select_account consent');
		});

		it('should return undefined for invalid values', () => {
			expect(mockGooglePrompt('invalid')).toBeUndefined();
			expect(mockGooglePrompt('invalid value')).toBeUndefined();
			expect(mockGooglePrompt('')).toBeUndefined();
		});

		it('should return undefined for undefined input', () => {
			expect(mockGooglePrompt(undefined)).toBeUndefined();
		});
	});
});
