import { formatTicketLabel } from './jackpotFormat';

/** Web `JackpotCylinderStage` constants. */
export const DRUM_FACE_COUNT = 12;
export const DRUM_FACE_ANGLE = 360 / DRUM_FACE_COUNT;
export const DRUM_FULL_TURNS = 6;
export const DRUM_TOTAL_ANGLE = DRUM_FULL_TURNS * 360;
/** Face 0 swaps its `?` for the winner once it has turned out of view. */
export const DRUM_WINNER_SWAP_ANGLE = 180;
/** `.jackpot-cylinder__viewport { perspective: 1000px }`. */
export const DRUM_PERSPECTIVE = 1000;

/** Spin easing: `1 - (1 - p)^3.8`. */
export function easeDrumSpin(progress: number): number {
  'worklet';
  const clamped = Math.min(Math.max(progress, 0), 1);
  return 1 - Math.pow(1 - clamped, 3.8);
}

/** Drum angle (degrees) at `progress` 0–1 of the spin. */
export function getDrumAngle(progress: number): number {
  'worklet';
  return easeDrumSpin(progress) * DRUM_TOTAL_ANGLE;
}

/** `#04`, or `?` while the face hides the winner. */
export function formatDrumFaceLabel(ticketNumber: number | null): string {
  return ticketNumber === null ? '?' : formatTicketLabel(ticketNumber);
}

/**
 * Faces 1–11 show real tickets from the pool, spread evenly when the pool has
 * more tickets than the drum has faces. `hiddenTicket` (the winner, once face 0
 * shows it) is left out.
 */
export function pickOtherFaceTickets(ticketNumbers: number[], hiddenTicket: number | null): (number | null)[] {
  const slots = DRUM_FACE_COUNT - 1;
  const otherTickets = ticketNumbers.filter((ticketNumber) => ticketNumber !== hiddenTicket);
  const source = otherTickets.length > 0 ? otherTickets : ticketNumbers;
  if (source.length === 0) return Array.from({ length: slots }, () => null);
  const stride = source.length > slots ? source.length / slots : 1;
  return Array.from({ length: slots }, (_, index) => source[Math.floor(index * stride) % source.length]);
}

/**
 * The twelve face labels. Until face 0 shows the winner, the winner stays
 * among the other faces too: leaving it out would hint at the result in
 * small pools.
 */
export function getDrumFaceLabels(
  ticketNumbers: number[],
  winningTicketNumber: number | null,
  showWinnerFace: boolean,
): string[] {
  const hidden = showWinnerFace ? winningTicketNumber : null;
  return [
    formatDrumFaceLabel(showWinnerFace ? winningTicketNumber : null),
    ...pickOtherFaceTickets(ticketNumbers, hidden).map(formatDrumFaceLabel),
  ];
}

/** Front face size factor from `translateZ(radius)` under the perspective. */
export function getDrumFrontScale(radius: number, perspective = DRUM_PERSPECTIVE): number {
  return perspective / (perspective - radius);
}

/**
 * CSS `perspective(d) rotateX(angle) translateZ(radius) scale(1 / renderScale)`
 * as a column-major 4×4 matrix (React Native `matrix` transform). Faces are laid
 * out `renderScale` times larger so the front face is not upscaled.
 */
export function getDrumFaceMatrix(
  angleDegrees: number,
  radius: number,
  renderScale: number,
  perspectiveOverride?: number,
): number[] {
  'worklet';
  // Default inside the body: worklets do not capture constants used in default parameters.
  const perspective = perspectiveOverride ?? DRUM_PERSPECTIVE;
  const radians = (angleDegrees * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const k = 1 / renderScale;
  return [
    k, 0, 0, 0,
    0, c * k, s * k, (-s * k) / perspective,
    0, -s, c, -c / perspective,
    0, -s * radius, c * radius, 1 - (c * radius) / perspective,
  ];
}

/** `backface-visibility: hidden`: a face shows while its front points at the eye. */
export function isDrumFaceFrontFacing(angleDegrees: number, radius: number, perspectiveOverride?: number): boolean {
  'worklet';
  const perspective = perspectiveOverride ?? DRUM_PERSPECTIVE;
  return perspective * Math.cos((angleDegrees * Math.PI) / 180) > radius;
}
