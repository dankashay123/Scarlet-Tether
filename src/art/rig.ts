/**
 * A side-view humanoid skeleton. Angles are radians measured from straight
 * down; positive swings toward the facing direction (right).
 */
export interface Limb {
  a: number; // upper segment angle
  b: number; // bend at the middle joint (elbow/knee), added to `a`
}

export interface Pose {
  x: number; // hip position
  y: number;
  lean: number; // torso lean (+ forward)
  head: number; // head tilt (+ nods forward)
  armF: Limb;
  armB: Limb;
  legF: Limb;
  legB: Limb;
  t: number; // animation phase for cloth & hair
}

export interface Proportions {
  torso: number;
  neck: number;
  thigh: number;
  shin: number;
  upperArm: number;
  foreArm: number;
  shoulderBack: number; // shoulder offset behind the spine
}

export interface Joints {
  hip: [number, number];
  shoulder: [number, number];
  neck: [number, number];
  head: [number, number];
  elbowF: [number, number];
  handF: [number, number];
  elbowB: [number, number];
  handB: [number, number];
  kneeF: [number, number];
  footF: [number, number];
  kneeB: [number, number];
  footB: [number, number];
}

const seg = (p: [number, number], ang: number, len: number): [number, number] => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len];

export function solve(p: Pose, pr: Proportions): Joints {
  const hip: [number, number] = [p.x, p.y];
  const shoulder: [number, number] = [hip[0] + Math.sin(p.lean) * pr.torso - pr.shoulderBack, hip[1] - Math.cos(p.lean) * pr.torso];
  const neck: [number, number] = [shoulder[0] + Math.sin(p.lean + p.head * 0.5) * pr.neck + pr.shoulderBack, shoulder[1] - Math.cos(p.lean) * pr.neck];
  const head: [number, number] = [neck[0] + Math.sin(p.lean + p.head) * 5, neck[1] - Math.cos(p.lean + p.head) * 5];
  const elbowF = seg(shoulder, p.armF.a, pr.upperArm);
  const handF = seg(elbowF, p.armF.a + p.armF.b, pr.foreArm);
  const elbowB = seg(shoulder, p.armB.a, pr.upperArm);
  const handB = seg(elbowB, p.armB.a + p.armB.b, pr.foreArm);
  const kneeF = seg(hip, p.legF.a, pr.thigh);
  const footF = seg(kneeF, p.legF.a - p.legF.b, pr.shin);
  const kneeB = seg(hip, p.legB.a, pr.thigh);
  const footB = seg(kneeB, p.legB.a - p.legB.b, pr.shin);
  return { hip, shoulder, neck, head, elbowF, handF, elbowB, handB, kneeF, footF, kneeB, footB };
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const l = (x: Limb, y: Limb): Limb => ({ a: lerp(x.a, y.a, t), b: lerp(x.b, y.b, t) });
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    lean: lerp(a.lean, b.lean, t),
    head: lerp(a.head, b.head, t),
    armF: l(a.armF, b.armF),
    armB: l(a.armB, b.armB),
    legF: l(a.legF, b.legF),
    legB: l(a.legB, b.legB),
    t: lerp(a.t, b.t, t),
  };
}

/** A run cycle: phase 0..1. */
export function runCycle(base: Pose, ph: number, stride = 0.75, lift = 0.9): Pose {
  const s = Math.sin(ph * Math.PI * 2);
  const c = Math.cos(ph * Math.PI * 2);
  return {
    ...base,
    y: base.y - Math.abs(c) * 2 + 1,
    lean: base.lean + 0.18,
    legF: { a: s * stride, b: Math.max(0, -c) * lift + 0.15 },
    legB: { a: -s * stride, b: Math.max(0, c) * lift + 0.15 },
    armF: { a: -s * 0.7 + 0.1, b: 0.6 },
    armB: { a: s * 0.7 + 0.1, b: 0.6 },
    t: ph,
  };
}
