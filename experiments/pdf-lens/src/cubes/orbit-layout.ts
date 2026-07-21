/**
 * Collision-aware placement of stat cubes around the lens.
 *
 * Cubes are laid out on a ring around the lens center, but the ring is biased
 * toward whichever side has room: near a page edge the cubes fan into open
 * space instead of overflowing off-screen. Returns absolute positions (in the
 * stage's coordinate space) plus an anchor point for the connector line.
 */
export interface CubeBox {
  width: number;
  height: number;
}

export interface Placement {
  x: number; // top-left of the cube
  y: number;
  anchorX: number; // point on the cube nearest the lens (for the connector)
  anchorY: number;
}

export interface OrbitInput {
  lens: { x: number; y: number; radius: number };
  stage: { width: number; height: number };
  cubes: CubeBox[];
}

/**
 * Choose candidate angles around the lens, preferring the side of the stage
 * with the most space, then place each cube along its ray, clamped on-stage.
 */
export function layoutOrbit({ lens, stage, cubes }: OrbitInput): Placement[] {
  const n = cubes.length;
  if (n === 0) return [];

  // Which way is "open"? Push the arc toward the larger margin.
  const spaceRight = stage.width - lens.x;
  const spaceLeft = lens.x;
  const baseDir = spaceRight >= spaceLeft ? 0 : Math.PI; // 0 = to the right
  const spread = Math.PI * (n === 1 ? 0 : 1.15); // fan width
  const gap = lens.radius + 26;

  return cubes.map((cube, i) => {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5; // -0.5..0.5
    const angle = baseDir + t * spread;
    const radius = gap + Math.max(cube.width, cube.height) * 0.5;

    let cx = lens.x + Math.cos(angle) * radius;
    let cy = lens.y + Math.sin(angle) * radius;

    // Convert center → top-left, then clamp fully on-stage.
    let x = cx - cube.width / 2;
    let y = cy - cube.height / 2;
    const pad = 8;
    x = Math.max(pad, Math.min(stage.width - cube.width - pad, x));
    y = Math.max(pad, Math.min(stage.height - cube.height - pad, y));

    // Anchor = edge of the cube facing the lens.
    const anchorX = Math.max(x, Math.min(x + cube.width, lens.x));
    const anchorY = Math.max(y, Math.min(y + cube.height, lens.y));
    return { x, y, anchorX, anchorY };
  });
}
