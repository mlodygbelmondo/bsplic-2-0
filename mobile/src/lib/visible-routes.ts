interface RouteNode {
  key?: string;
  name: string;
  state?: StateNode;
}

interface StateNode {
  index?: number;
  routes: RouteNode[];
}

/** Full-screen modals among the sheet routes: the screen under them is hidden. */
const COVERING_SHEETS = new Set(['sheets/compose-story', 'sheets/story-viewer']);

/**
 * Keys of the routes on screen: the focused route at every level and, below
 * sheets presented on top, the route each one covers (still visible around
 * the sheet). Other tabs and screens pushed under the top one are not.
 */
export function collectVisibleRouteKeys(state: StateNode | undefined, keys = new Set<string>()): Set<string> {
  if (!state?.routes?.length) return keys;
  let index = Math.min(state.index ?? state.routes.length - 1, state.routes.length - 1);
  while (index >= 0) {
    const route = state.routes[index];
    if (route.key) keys.add(route.key);
    collectVisibleRouteKeys(route.state, keys);
    if (!route.name.startsWith('sheets/') || COVERING_SHEETS.has(route.name)) break;
    index -= 1;
  }
  return keys;
}
