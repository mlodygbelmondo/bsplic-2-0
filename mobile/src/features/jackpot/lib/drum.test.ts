import { describe, expect, it } from 'vitest';

import {
  getDrumAngle,
  getDrumFaceLabels,
  getDrumFaceMatrix,
  getDrumFrontScale,
  isDrumFaceFrontFacing,
  pickOtherFaceTickets,
} from './drum';

/** Projects a face-local point through a column-major 4×4 matrix (CSS order). */
function project(matrix: number[], x: number, y: number) {
  const px = matrix[0] * x + matrix[4] * y + matrix[12];
  const py = matrix[1] * x + matrix[5] * y + matrix[13];
  const pw = matrix[3] * x + matrix[7] * y + matrix[15];
  return { x: px / pw, y: py / pw };
}

describe('jackpot ticket drum', () => {
  it('spins six full turns and lands back on face 0', () => {
    expect(getDrumAngle(0)).toBe(0);
    expect(getDrumAngle(1)).toBe(2160);
    // 1 - (1 - 0.5)^3.8 = 0.92820…
    expect(getDrumAngle(0.5)).toBeCloseTo(2004.9, 1);
    expect(getDrumAngle(2)).toBe(2160);
  });

  it('fills the other faces with real pool tickets, spread over large pools', () => {
    expect(pickOtherFaceTickets([1, 2, 3, 4], null)).toEqual([1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3]);
    expect(pickOtherFaceTickets([1, 2, 3, 4], 4)).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2]);
    expect(pickOtherFaceTickets([7], 7)).toEqual(Array.from({ length: 11 }, () => 7));
    expect(pickOtherFaceTickets([], null)).toEqual(Array.from({ length: 11 }, () => null));
    const many = Array.from({ length: 22 }, (_, index) => index + 1);
    expect(pickOtherFaceTickets(many, null)).toEqual([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]);
  });

  it('hides the winner behind a question mark until face 0 shows it', () => {
    const before = getDrumFaceLabels([1, 2, 3, 4], 4, false);
    expect(before[0]).toBe('?');
    expect(new Set(before.slice(1))).toEqual(new Set(['#01', '#02', '#03', '#04']));

    const after = getDrumFaceLabels([1, 2, 3, 4], 4, true);
    expect(after[0]).toBe('#04');
    expect(after.slice(1)).not.toContain('#04');
    expect(getDrumFaceLabels([1, 2], null, true)[0]).toBe('?');
  });

  it('projects faces like CSS perspective(1000px) rotateX() translateZ()', () => {
    const radius = 148;
    const scale = getDrumFrontScale(radius);
    expect(scale).toBeCloseTo(1000 / 852);

    // The front face sits at native size once its layout is scaled up by the same factor.
    const front = getDrumFaceMatrix(0, radius, scale);
    const corner = project(front, 128 * scale, 34 * scale);
    expect(corner.x).toBeCloseTo(128 * scale);
    expect(corner.y).toBeCloseTo(34 * scale);

    // rotateX(30deg) turns the face up: centre y = -r·sin / (1 - r·cos / d).
    const above = project(getDrumFaceMatrix(30, radius, 1), 0, 0);
    expect(above.x).toBeCloseTo(0);
    expect(above.y).toBeCloseTo(-74 / (1 - (148 * Math.cos(Math.PI / 6)) / 1000), 4);
  });

  it('culls faces turned away from the viewer', () => {
    expect(isDrumFaceFrontFacing(0, 148)).toBe(true);
    expect(isDrumFaceFrontFacing(80, 148)).toBe(true);
    expect(isDrumFaceFrontFacing(82, 148)).toBe(false);
    expect(isDrumFaceFrontFacing(180, 148)).toBe(false);
  });
});
