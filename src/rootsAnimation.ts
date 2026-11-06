/**
 * Procedural Botanical Root System — Rosé Pine Edition
 * Generates a unique, high-density organic root silhouette on every session,
 * featuring a massive root crown behind `.brand-mark`, proximal anastomosis
 * (interlocking root bridges), tapered polygonal segments with webbed collars,
 * gnarled S-curves, needle-fine capillary rootlets, and long diagonal taproots
 * sweeping 88%–98% across the viewport diagonal.
 */

interface RootSegment {
  step: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  x2: number;
  y2: number;
  r1: number;
  r2: number;
  a1: number;
  a2: number;
  color: string;
  alpha: number;
}

interface ActiveTip {
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  angularVel: number;
  thickness: number;
  collarScale: number;
  step: number;
  stepsSinceSplit: number;
  nextSplitAt: number;
  generation: number;
  splitCount: number;
  trunkId: number;
  seed: number;
  isLeader: boolean;
  isCapillary: boolean;
  maxSteps: number;
}

interface TrunkAnchor {
  x: number;
  y: number;
  step: number;
  trunkId: number;
  thickness: number;
}

const RGB_ROSE: [number, number, number] = [235, 188, 186]; // #ebbcba
const RGB_IRIS: [number, number, number] = [196, 167, 231]; // #c4a7e7
const RGB_FOAM: [number, number, number] = [156, 207, 216]; // #9ccfd8
const RGB_PINE: [number, number, number] = [49, 116, 143];  // #31748f

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateRootColor(normalizedDist: number): string {
  const t = Math.max(0, Math.min(1, normalizedDist));
  let c1: [number, number, number];
  let c2: [number, number, number];
  let localT: number;

  if (t < 0.42) {
    c1 = RGB_ROSE;
    c2 = RGB_IRIS;
    localT = t / 0.42;
  } else if (t < 0.78) {
    c1 = RGB_IRIS;
    c2 = RGB_FOAM;
    localT = (t - 0.42) / 0.36;
  } else {
    c1 = RGB_FOAM;
    c2 = RGB_PINE;
    localT = (t - 0.78) / 0.22;
  }

  const r = Math.round(lerp(c1[0], c2[0], localT));
  const g = Math.round(lerp(c1[1], c2[1], localT));
  const b = Math.round(lerp(c1[2], c2[2], localT));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Mulberry32 PRNG seeded per session so every load produces a unique
 * botanical root network while remaining stable across viewport resizes.
 */
function createRng(initialSeed: number): () => number {
  let s = initialSeed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a multi-segment sinuous anastomosis bridge connecting two thick
 * proximal trunks to form the characteristic hollow root islands near the crown.
 */
function emitAnastomosisBridge(
  segments: RootSegment[],
  rng: () => number,
  xStart: number,
  yStart: number,
  xEnd: number,
  yEnd: number,
  startStep: number,
  bridgeThickness: number,
  originX: number,
  originY: number,
  maxDiagonal: number
): void {
  const dist = Math.hypot(xEnd - xStart, yEnd - yStart);
  const steps = Math.max(3, Math.min(6, Math.round(dist / 16)));
  const baseAngle = Math.atan2(yEnd - yStart, xEnd - xStart);
  const perpX = -Math.sin(baseAngle);
  const perpY = Math.cos(baseAngle);
  const archSign = rng() < 0.5 ? 1 : -1;
  const archAmp = dist * (0.12 + rng() * 0.14) * archSign;

  let prevX = xStart;
  let prevY = yStart;
  let prevAngle = baseAngle + archSign * 0.28;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const midT = (i - 0.5) / steps;

    const archOffset = Math.sin(t * Math.PI) * archAmp;
    const midArchOffset = Math.sin(midT * Math.PI) * archAmp;

    const nx = lerp(xStart, xEnd, t) + perpX * archOffset;
    const ny = lerp(yStart, yEnd, t) + perpY * archOffset;
    const cx = lerp(xStart, xEnd, midT) + perpX * midArchOffset * 1.08;
    const cy = lerp(yStart, yEnd, midT) + perpY * midArchOffset * 1.08;

    const nextAngle = Math.atan2(ny - prevY, nx - prevX);

    // Flared at both ends where the bridge fuses into the parent trunks, thinner in the middle
    const waistFactor1 = 1 - 0.24 * Math.sin(((i - 1) / steps) * Math.PI);
    const waistFactor2 = 1 - 0.24 * Math.sin(t * Math.PI);
    const collarBoost1 = i === 1 ? 1.22 : 1.0;
    const collarBoost2 = i === steps ? 1.22 : 1.0;

    const r1 = (bridgeThickness * 0.5) * waistFactor1 * collarBoost1;
    const r2 = (bridgeThickness * 0.5) * waistFactor2 * collarBoost2;

    const d = Math.hypot(nx - originX, ny - originY);
    const color = interpolateRootColor(d / maxDiagonal);

    segments.push({
      step: startStep + i,
      x1: prevX,
      y1: prevY,
      cx,
      cy,
      x2: nx,
      y2: ny,
      r1,
      r2,
      a1: prevAngle,
      a2: nextAngle,
      color,
      alpha: 0.92
    });

    prevX = nx;
    prevY = ny;
    prevAngle = nextAngle;
  }
}

function buildRootNetwork(
  width: number,
  height: number,
  originX: number,
  originY: number,
  sessionSeed: number
): { segments: RootSegment[]; maxStep: number } {
  const rng = createRng(sessionSeed);
  const segments: RootSegment[] = [];
  const maxDiagonal = Math.hypot(width - originX, height - originY) || 1;
  const diagAngle = Math.atan2(height - originY, width - originX);

  // Proportional scale factor so large desktop viewports get long, sweeping diagonal reach
  const viewportScale = Math.max(1, maxDiagonal / 1350);
  const trunkScale = Math.min(1.25, Math.pow(viewportScale, 0.35));

  // 8 primary trunks (14px to 22px base thickness) fanning out from the root collar behind .brand-mark
  const trunkProfiles = [
    // Upper-right lateral sweeping trunks (along top/hero toward right side)
    { angleOffset: -0.46, thickness: 14.8, splitWait: 7 },
    { angleOffset: -0.28, thickness: 17.6, splitWait: 8 },
    { angleOffset: -0.13, thickness: 19.8, splitWait: 8 },
    // Central massive diagonal taproots (sweeping all the way to bottom-right corner)
    { angleOffset: -0.02, thickness: 22.0, splitWait: 9 },
    { angleOffset: 0.07, thickness: 21.0, splitWait: 9 },
    { angleOffset: 0.20, thickness: 18.8, splitWait: 8 },
    // Lower-diagonal & steeper left-ward trunks
    { angleOffset: 0.38, thickness: 16.8, splitWait: 8 },
    { angleOffset: 0.58, thickness: 15.0, splitWait: 7 }
  ];

  const queue: ActiveTip[] = trunkProfiles.map((profile, idx) => {
    const jitterAngle = (rng() - 0.5) * 0.06;
    const startAngle = diagAngle + profile.angleOffset + jitterAngle;
    const startThickness = profile.thickness * trunkScale * (0.94 + rng() * 0.14);
    // Offset initial positions slightly around the collar so they coalesce into a massive crown
    const offsetRadius = (idx - 3.5) * 2.2;
    const perpAngle = diagAngle + Math.PI * 0.5;

    return {
      x: originX + Math.cos(perpAngle) * offsetRadius,
      y: originY + Math.sin(perpAngle) * offsetRadius,
      angle: startAngle,
      targetAngle: startAngle + (rng() - 0.5) * 0.06,
      angularVel: (rng() - 0.5) * 0.06,
      thickness: startThickness,
      collarScale: 1.24,
      step: idx % 3,
      stepsSinceSplit: 0,
      nextSplitAt: profile.splitWait + Math.floor(rng() * 4),
      generation: 0,
      splitCount: 0,
      trunkId: idx,
      seed: rng() * 200,
      isLeader: true,
      isCapillary: false,
      maxSteps: 320
    };
  });

  const trunkAnchors: TrunkAnchor[] = [];
  let bridgesCreated = 0;
  const maxBridges = 12;
  const maxSegments = 6500;
  let maxStep = 0;

  while (queue.length > 0 && segments.length < maxSegments) {
    const tip = queue.shift()!;

    // Reserve final segment budget exclusively for leader taproots so they never get cut short
    if (!tip.isLeader && segments.length >= maxSegments - 550) {
      continue;
    }

    if (
      tip.thickness < 0.15 ||
      tip.step > tip.maxSteps ||
      tip.x < -40 ||
      tip.x > width - 8 ||
      tip.y < -40 ||
      tip.y > height - 8
    ) {
      continue;
    }

    // Soft viewport-margin steering for leader trunks so they sweep toward the bottom-right region
    if (tip.isLeader) {
      const marginX = width * 0.05;
      const marginY = height * 0.05;
      if (tip.x > width - marginX || tip.y > height - marginY || tip.x < marginX || tip.y < marginY) {
        const cornerAngle = Math.atan2(height * 0.92 - tip.y, width * 0.92 - tip.x);
        tip.targetAngle = lerp(tip.targetAngle, cornerAngle, 0.32);
      }
    }

    // Step length scales with root thickness and viewport diagonal
    const thicknessNorm = Math.min(1, tip.thickness / (18.0 * trunkScale));
    const baseStepLen = tip.isCapillary
      ? lerp(4.5, 9.5, Math.min(1, tip.thickness / 2.2)) * Math.pow(viewportScale, 0.7)
      : lerp(9.0, 21.0, Math.pow(thicknessNorm, 0.55)) * viewportScale;
    const stepLength = baseStepLen * (0.88 + rng() * 0.24);

    // Gnarled S-curves: multi-frequency harmonic wave + organic kinks
    const sCurveWave =
      Math.sin(tip.step * 0.24 + tip.seed) * 0.072 +
      Math.cos(tip.step * 0.12 - tip.seed * 0.6) * 0.052;

    // Occasional sudden botanical kink/bend like roots navigating around stones
    const kink = rng() < 0.15 ? (rng() - 0.5) * (tip.isLeader ? 0.18 : 0.24) : 0;
    const pullStrength = tip.isLeader ? 0.11 : tip.isCapillary ? 0.03 : 0.065;
    const anglePull = (tip.targetAngle - tip.angle) * pullStrength;

    tip.angularVel =
      tip.angularVel * 0.76 +
      (rng() - 0.5) * (tip.isCapillary ? 0.14 : 0.08) +
      sCurveWave * 0.46 +
      kink +
      anglePull;

    const maxTurn = tip.isCapillary ? 0.34 : tip.isLeader ? 0.20 : 0.25;
    tip.angularVel = Math.max(-maxTurn, Math.min(maxTurn, tip.angularVel));

    const prevAngle = tip.angle;
    const nextAngle = tip.angle + tip.angularVel;
    const midAngle = prevAngle + tip.angularVel * 0.5 + (rng() - 0.5) * 0.1;

    const x2 = tip.x + Math.cos(nextAngle) * stepLength;
    const y2 = tip.y + Math.sin(nextAngle) * stepLength;
    const cx = tip.x + Math.cos(midAngle) * (stepLength * 0.54);
    const cy = tip.y + Math.sin(midAngle) * (stepLength * 0.54);

    const dist = Math.hypot(x2 - originX, y2 - originY);
    const normDist = dist / maxDiagonal;

    // Botanical conservation: leader taproots maintain girth across the diagonal,
    // then taper gracefully into needle-fine capillary tips in the final 80%..96% zone
    const distalTaper =
      normDist > 0.78
        ? lerp(1.0, 0.87, Math.min(1, (normDist - 0.78) / 0.19))
        : 1.0;

    const baseDecay =
      (tip.isCapillary
        ? 0.885 + rng() * 0.03
        : tip.isLeader
          ? tip.generation <= 1
            ? 0.989
            : tip.generation <= 3
              ? 0.983
              : 0.974
          : tip.generation <= 1
            ? 0.978
            : tip.generation === 2
              ? 0.968
              : tip.generation === 3
                ? 0.958
                : 0.946) * distalTaper;

    const nextThickness = Math.max(0.14, tip.thickness * baseDecay);

    // Apply collar flare on the first segment of a newly sprouted branch for webbed V-junctions
    const r1 = (tip.thickness * 0.5) * tip.collarScale;
    const r2 = nextThickness * 0.5;

    const color = interpolateRootColor(normDist);
    const alpha = Math.max(
      0.75,
      Math.min(0.98, 0.75 + Math.pow(Math.min(1, tip.thickness / 8.0), 0.55) * 0.23)
    );

    segments.push({
      step: tip.step,
      x1: tip.x,
      y1: tip.y,
      cx,
      cy,
      x2,
      y2,
      r1,
      r2,
      a1: prevAngle,
      a2: nextAngle,
      color,
      alpha
    });

    if (tip.step > maxStep) {
      maxStep = tip.step;
    }

    // Proximal Anastomosis (steps 5..28): bridge nearby thick roots to create hollow root islands
    if (
      !tip.isCapillary &&
      tip.step >= 5 &&
      tip.step <= 28 &&
      tip.thickness >= 5.2
    ) {
      if (bridgesCreated < maxBridges && tip.step % 2 === 0) {
        const minBridgeDist = 25 * Math.pow(viewportScale, 0.5);
        const maxBridgeDist = 115 * Math.pow(viewportScale, 0.65);

        for (let i = trunkAnchors.length - 1; i >= 0; i--) {
          const anchor = trunkAnchors[i];
          if (anchor.trunkId === tip.trunkId) continue;
          if (Math.abs(anchor.step - tip.step) > 8) continue;

          const dAnchor = Math.hypot(x2 - anchor.x, y2 - anchor.y);
          if (dAnchor >= minBridgeDist && dAnchor <= maxBridgeDist && rng() < 0.45) {
            const bridgeThick = Math.min(
              9.5,
              Math.max(4.0, Math.min(tip.thickness, anchor.thickness) * (0.42 + rng() * 0.18))
            );
            emitAnastomosisBridge(
              segments,
              rng,
              x2,
              y2,
              anchor.x,
              anchor.y,
              tip.step,
              bridgeThick,
              originX,
              originY,
              maxDiagonal
            );
            bridgesCreated++;
            break;
          }
        }
      }

      trunkAnchors.push({
        x: x2,
        y: y2,
        step: tip.step,
        trunkId: tip.trunkId,
        thickness: nextThickness
      });
    }

    // Distributed lateral "whiplash" capillary rootlets along the full diagonal span
    const capProb = nextThickness < 3.5 ? 0.16 : 0.11;
    if (
      !tip.isCapillary &&
      tip.step > 4 &&
      nextThickness >= 0.42 &&
      nextThickness <= 11.0 &&
      segments.length < maxSegments - 450 &&
      rng() < capProb
    ) {
      const sideSign = rng() < 0.5 ? 1 : -1;
      const capAngle = nextAngle + sideSign * (0.42 + rng() * 0.52);
      const capThickness = Math.min(2.2, Math.max(0.42, nextThickness * (0.26 + rng() * 0.18)));
      const capSteps = 9 + Math.floor(rng() * 16);

      queue.push({
        x: x2,
        y: y2,
        angle: capAngle,
        targetAngle: capAngle + sideSign * (0.15 + rng() * 0.25),
        angularVel: sideSign * (0.04 + rng() * 0.08),
        thickness: capThickness,
        collarScale: 1.22,
        step: tip.step + 1,
        stepsSinceSplit: 0,
        nextSplitAt: 5 + Math.floor(rng() * 6),
        generation: tip.generation + 2,
        splitCount: tip.splitCount + 1,
        trunkId: tip.trunkId,
        seed: tip.seed + 19.7 + rng() * 30,
        isLeader: false,
        isCapillary: true,
        maxSteps: tip.step + capSteps
      });
    }

    tip.stepsSinceSplit++;
    const maxGenAllowed = tip.isLeader ? 12 : 6;
    const minSplitThickness = tip.isCapillary ? 0.38 : tip.isLeader ? 0.35 : 0.62;
    const canNonLeaderSplit = tip.isLeader || segments.length < maxSegments - 1100;
    const shouldSplit =
      canNonLeaderSplit &&
      tip.stepsSinceSplit >= tip.nextSplitAt &&
      tip.generation < maxGenAllowed &&
      nextThickness > minSplitThickness;

    if (shouldSplit) {
      const splitSign = rng() < 0.5 ? 1 : -1;

      if (tip.isLeader) {
        // Murray's law conservation for leader taproots so they cross 88%-98% of the diagonal
        const mainDeflection = -splitSign * (0.07 + rng() * 0.11);
        const branchDeflection = splitSign * (0.26 + rng() * 0.34);

        const mainThickness = nextThickness * (0.89 + rng() * 0.05);
        const branchThickness = nextThickness * (0.56 + rng() * 0.16);
        const nextSplitCount = tip.splitCount + 1;
        const leaderNextGen = tip.generation + (nextSplitCount % 2 === 0 ? 1 : 0);

        // Dominant leader continuation anchored near its diagonal trajectory
        queue.push({
          x: x2,
          y: y2,
          angle: nextAngle + mainDeflection,
          targetAngle: tip.targetAngle + mainDeflection * 0.28,
          angularVel: tip.angularVel * 0.45,
          thickness: mainThickness,
          collarScale: 1.15,
          step: tip.step + 1,
          stepsSinceSplit: 0,
          nextSplitAt: 9 + Math.floor(rng() * 8),
          generation: leaderNextGen,
          splitCount: nextSplitCount,
          trunkId: tip.trunkId,
          seed: tip.seed + 5.3,
          isLeader: true,
          isCapillary: false,
          maxSteps: tip.maxSteps
        });

        // Secondary diverging branch (occasionally promoted to sub-leader in mid-field)
        const promoteSubLeader = normDist < 0.58 && branchThickness > 3.2 && rng() < 0.3;
        queue.push({
          x: x2,
          y: y2,
          angle: nextAngle + branchDeflection,
          targetAngle: nextAngle + branchDeflection * 0.82,
          angularVel: (rng() - 0.5) * 0.08,
          thickness: branchThickness,
          collarScale: 1.2,
          step: tip.step + 1,
          stepsSinceSplit: 0,
          nextSplitAt: (promoteSubLeader ? 8 : 6) + Math.floor(rng() * 7),
          generation: tip.generation + 1,
          splitCount: nextSplitCount,
          trunkId: tip.trunkId + 100 + tip.step,
          seed: tip.seed + 13.9,
          isLeader: promoteSubLeader,
          isCapillary: branchThickness < 1.1,
          maxSteps: promoteSubLeader ? 280 : 220
        });
      } else {
        // Non-leader secondary/tertiary asymmetric bifurcation
        const mainDeflection = -splitSign * (0.11 + rng() * 0.18);
        const branchDeflection = splitSign * (0.28 + rng() * 0.38);

        const mainThickness = nextThickness * (0.82 + rng() * 0.07);
        const branchThickness = nextThickness * (0.58 + rng() * 0.17);

        queue.push({
          x: x2,
          y: y2,
          angle: nextAngle + mainDeflection,
          targetAngle: tip.targetAngle + mainDeflection * 0.6,
          angularVel: tip.angularVel * 0.45,
          thickness: mainThickness,
          collarScale: 1.16,
          step: tip.step + 1,
          stepsSinceSplit: 0,
          nextSplitAt: (tip.isCapillary ? 4 : 6) + Math.floor(rng() * 8),
          generation: tip.generation + 1,
          splitCount: tip.splitCount + 1,
          trunkId: tip.trunkId,
          seed: tip.seed + 5.3,
          isLeader: false,
          isCapillary: tip.isCapillary,
          maxSteps: tip.maxSteps
        });

        queue.push({
          x: x2,
          y: y2,
          angle: nextAngle + branchDeflection,
          targetAngle: nextAngle + branchDeflection * 0.88,
          angularVel: (rng() - 0.5) * 0.09,
          thickness: branchThickness,
          collarScale: 1.2,
          step: tip.step + 1,
          stepsSinceSplit: 0,
          nextSplitAt: (tip.isCapillary ? 4 : 5) + Math.floor(rng() * 8),
          generation: tip.generation + 1,
          splitCount: tip.splitCount + 1,
          trunkId: tip.trunkId + 100 + tip.step,
          seed: tip.seed + 13.9,
          isLeader: false,
          isCapillary: tip.isCapillary || branchThickness < 1.15,
          maxSteps: tip.maxSteps
        });
      }

      // Occasional trifurcation or fine spur at major forks
      if (nextThickness > 2.4 && segments.length < maxSegments - 300 && rng() < 0.34) {
        const spurSign = -splitSign;
        const spurAngle = nextAngle + spurSign * (0.48 + rng() * 0.32);
        const spurThickness = nextThickness * (0.34 + rng() * 0.14);
        queue.push({
          x: x2,
          y: y2,
          angle: spurAngle,
          targetAngle: spurAngle + spurSign * 0.18,
          angularVel: (rng() - 0.5) * 0.1,
          thickness: spurThickness,
          collarScale: 1.18,
          step: tip.step + 1,
          stepsSinceSplit: 0,
          nextSplitAt: 6 + Math.floor(rng() * 7),
          generation: tip.generation + 2,
          splitCount: tip.splitCount + 1,
          trunkId: tip.trunkId + 200 + tip.step,
          seed: tip.seed + 29.1,
          isLeader: false,
          isCapillary: spurThickness < 1.3,
          maxSteps: tip.step + 36
        });
      }
    } else {
      // Continue organic growth
      queue.push({
        ...tip,
        x: x2,
        y: y2,
        angle: nextAngle,
        thickness: nextThickness,
        collarScale: 1.0,
        step: tip.step + 1
      });
    }
  }

  segments.sort((a, b) => a.step - b.step);
  return { segments, maxStep: Math.max(1, maxStep) };
}

/**
 * Draws the solid organic root collar/crown behind `.brand-mark` from which
 * all primary trunks emerge.
 */
function drawRootCollar(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  diagAngle: number
): void {
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(diagAngle - Math.PI * 0.5);

  // Soft ambient aura behind the crown
  const grad = ctx.createRadialGradient(0, 4, 4, 0, 4, 42);
  grad.addColorStop(0, "rgba(235, 188, 186, 0.55)");
  grad.addColorStop(0.5, "rgba(196, 167, 231, 0.2)");
  grad.addColorStop(1, "rgba(196, 167, 231, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 4, 42, 0, Math.PI * 2);
  ctx.fill();

  // Solid botanical root stump/collar silhouette matching the reference image
  ctx.fillStyle = "rgb(235, 188, 186)";
  ctx.globalAlpha = 0.94;
  ctx.beginPath();
  ctx.moveTo(-16, -10);
  ctx.quadraticCurveTo(0, -13, 16, -10);
  ctx.quadraticCurveTo(19, 2, 24, 12);
  ctx.quadraticCurveTo(0, 17, -24, 12);
  ctx.quadraticCurveTo(-19, 2, -16, -10);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Renders a single tapered polygonal root segment (`r1` -> `r2`) using
 * quadratic Bezier side walls and a seamless circular joint at `(x1, y1)`.
 */
function drawSegment(ctx: CanvasRenderingContext2D, seg: RootSegment): void {
  const { x1, y1, cx, cy, x2, y2, r1, r2, a1, a2, color, alpha } = seg;

  // Normal vectors perpendicular to start, control, and end tangents
  const nx1 = -Math.sin(a1);
  const ny1 = Math.cos(a1);
  const nx2 = -Math.sin(a2);
  const ny2 = Math.cos(a2);

  const midAngle = Math.atan2(y2 - y1, x2 - x1);
  const ncx = -Math.sin(midAngle);
  const ncy = Math.cos(midAngle);
  const rMid = (r1 + r2) * 0.5;

  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;

  // Tapered ribbon polygon with quadratic curved left and right walls
  ctx.beginPath();
  ctx.moveTo(x1 + nx1 * r1, y1 + ny1 * r1);
  ctx.quadraticCurveTo(
    cx + ncx * rMid,
    cy + ncy * rMid,
    x2 + nx2 * r2,
    y2 + ny2 * r2
  );
  ctx.lineTo(x2 - nx2 * r2, y2 - ny2 * r2);
  ctx.quadraticCurveTo(
    cx - ncx * rMid,
    cy - ncy * rMid,
    x1 - nx1 * r1,
    y1 - ny1 * r1
  );
  ctx.closePath();
  ctx.fill();

  // Seamless union joint at segment origin (creates smooth knuckle/collar on turns and forks)
  if (r1 > 0.2) {
    ctx.beginPath();
    ctx.arc(x1, y1, r1, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function initRootsBackground(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Unique seed on every application open
  const sessionSeed =
    ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) ^ 0x5f3759df) >>> 0;
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let rafId: number | null = null;
  let resizeTimer: number | null = null;

  function measureOrigin(): { width: number; height: number; originX: number; originY: number } {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const brandMark = document.querySelector<HTMLElement>(".brand-mark");

    if (brandMark) {
      const rect = brandMark.getBoundingClientRect();
      return {
        width,
        height,
        originX: rect.left + rect.width * 0.5,
        originY: rect.top + rect.height * 0.5
      };
    }

    return { width, height, originX: 48, originY: 32 };
  }

  function setupCanvasDimensions(width: number, height: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function renderStatic(): void {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }

    const { width, height, originX, originY } = measureOrigin();
    setupCanvasDimensions(width, height);
    ctx!.clearRect(0, 0, width, height);

    const diagAngle = Math.atan2(height - originY, width - originX);
    const { segments } = buildRootNetwork(width, height, originX, originY, sessionSeed);
    drawRootCollar(ctx!, originX, originY, diagAngle);
    for (let i = 0; i < segments.length; i++) {
      drawSegment(ctx!, segments[i]);
    }
    canvas.classList.add("is-settled");
  }

  function runGrowthAnimation(): void {
    if (reducedMotionQuery.matches) {
      renderStatic();
      return;
    }

    const { width, height, originX, originY } = measureOrigin();
    setupCanvasDimensions(width, height);
    ctx!.clearRect(0, 0, width, height);

    const diagAngle = Math.atan2(height - originY, width - originX);
    const { segments, maxStep } = buildRootNetwork(width, height, originX, originY, sessionSeed);
    drawRootCollar(ctx!, originX, originY, diagAngle);

    let cursor = 0;
    const durationMs = 3200;
    const startTime = performance.now();

    function frame(now: number): void {
      const elapsed = now - startTime;
      const rawProgress = Math.min(1, elapsed / durationMs);
      // Smooth ease-out for rapid primary trunk burst and delicate capillary finish
      const easedProgress = 1 - Math.pow(1 - rawProgress, 2.4);
      const targetStep = easedProgress * maxStep;

      while (cursor < segments.length && segments[cursor].step <= targetStep) {
        drawSegment(ctx!, segments[cursor]);
        cursor++;
      }

      if (rawProgress < 1) {
        rafId = window.requestAnimationFrame(frame);
      } else {
        while (cursor < segments.length) {
          drawSegment(ctx!, segments[cursor]);
          cursor++;
        }
        rafId = null;
        canvas.classList.add("is-settled");
      }
    }

    rafId = window.requestAnimationFrame(frame);
  }

  // Start organic growth on initial application load
  runGrowthAnimation();

  // Debounced static redraw on viewport resize so roots remain anchored behind .brand-mark
  let lastWidth = window.innerWidth;
  let lastHeight = window.innerHeight;

  window.addEventListener(
    "resize",
    () => {
      const dw = Math.abs(window.innerWidth - lastWidth);
      const dh = Math.abs(window.innerHeight - lastHeight);
      if (dw < 40 && dh < 60) return;

      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        resizeTimer = null;
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;
        renderStatic();
      }, 180);
    },
    { passive: true }
  );
}
