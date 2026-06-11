import { get } from '@vercel/edge-config';
import { next, rewrite } from '@vercel/functions';

const MAINTENANCE_PAGE = '/maintenance.html';
const MAINTENANCE_KEY = 'maintenanceMode';

const PUBLIC_FILE_PATTERN = /\.(?:css|gif|ico|jpg|jpeg|js|json|map|png|svg|txt|webmanifest|webp|woff2?)$/i;
const PUBLIC_PATH_PREFIXES = [
  '/assets/',
  '/badges/',
  '/casino/',
  '/maintenance/',
  '/~oauth/',
];

export const config = {
  matcher: '/:path*',
};

function shouldSkipMiddleware(pathname: string) {
  if (pathname === MAINTENANCE_PAGE) {
    return true;
  }

  if (PUBLIC_FILE_PATTERN.test(pathname)) {
    return true;
  }

  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default async function middleware(request: Request) {
  const url = new URL(request.url);

  if (shouldSkipMiddleware(url.pathname)) {
    return next();
  }

  try {
    const maintenanceMode = await get<boolean>(MAINTENANCE_KEY);

    if (maintenanceMode === true) {
      return rewrite(new URL(MAINTENANCE_PAGE, request.url));
    }
  } catch (error) {
    console.error('Failed to read maintenance mode from Edge Config', error);
  }

  return next();
}
