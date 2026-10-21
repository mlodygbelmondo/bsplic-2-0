import { router, type Href } from 'expo-router';

interface NavigationLike {
  getState(): { type?: string } | undefined;
  getParent(): NavigationLike | undefined;
}

/** True when the calling screen lives inside the NativeTabs navigator. */
function isInsideTabs(navigation: NavigationLike): boolean {
  let current: NavigationLike | undefined = navigation;
  while (current) {
    if (current.getState()?.type === 'tab') return true;
    current = current.getParent();
  }
  return false;
}

/**
 * Web `<Link to=…>` from the header and the menu. Inside the tabs a plain
 * navigate switches tabs; from a pushed screen or a sheet over the tabs,
 * `dismissTo` pops back to the tab navigator (a plain navigate would push a
 * second copy of the tabs). Pushed routes that are not open yet (`/admin`)
 * replace the sheet.
 */
export function navigateFromChrome(navigation: NavigationLike, href: Href) {
  if (isInsideTabs(navigation)) {
    router.navigate(href);
  } else {
    router.dismissTo(href);
  }
}

/** Web `isActivePath`: `/` matches exactly, other links match their subtree. */
export function isActivePath(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}
