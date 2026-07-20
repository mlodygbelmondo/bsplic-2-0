export interface MobileEnvironment {
  supabaseUrl: string;
  supabasePublishableKey: string;
  webUrl: string;
}

const requireValue = (name: string, value: string | undefined): string => {
  const normalized = value?.trim();

  if (!normalized) {
    throw new Error(`Missing required Expo environment variable: ${name}`);
  }

  return normalized;
};

const requireHttpUrl = (name: string, value: string | undefined): string => {
  const normalized = requireValue(name, value);

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${name} must use http or https`);
  }

  return url.toString().replace(/\/$/, '');
};

export const env: Readonly<MobileEnvironment> = Object.freeze({
  // Expo requires static dot-notation references so Metro can inline these values.
  supabaseUrl: requireHttpUrl(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  ),
  supabasePublishableKey: requireValue(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  webUrl: requireHttpUrl(
    'EXPO_PUBLIC_WEB_URL',
    process.env.EXPO_PUBLIC_WEB_URL,
  ),
});
