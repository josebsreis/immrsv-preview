/* ═══════════════════════════════════════════════════════════════════
   Every tunable of the hero in one place. Nothing in the engine carries a
   magic number; everything reads from here, and a page can override any
   part of it when it creates the hero.
   ═══════════════════════════════════════════════════════════════════ */
import type { FluidOptions } from '../fluid';

export const HERO_CONFIG = {
  /** viewport width at or below which the mobile values apply */
  mobileMax: 719,

  camera: {
    fov: 19,
    dist: 9.2,
    distMobileScale: 1.26,        // the mark sits further away on phones
    isoYaw: Math.PI / 4,
    isoTilt: 0.61548,
    maxYaw: 0.16,                 // the object has no back — never turn far
    maxTilt: 0.11,
    easing: 0.05,
  },

  renderer: {
    dpr: 1.5,
    dprMobile: 1.25,
    ground: 0x060606,             // must match --ground in tokens.css (dark)
    exposure: 1.1,
  },

  mark: {
    thick: 0.075,                 // slab thickness, plate units
    separation: 0.175,            // rest gap between the three plates
    voidCentre: 1 / 3,            // the notch's implied cube centre — the pivot
    perPlate: 1600,               // particles over each face
    edgePerPlate: 800,            // particles along each outline
    pointPx: 18,                  // base point size (× device pixel ratio)
    spin: 0.2,                    // cruise angular speed, rad/s, about the diagonal
    wobble: 0.03,                 // slow tilt so the turn never feels like a loop
    tint: {                       // particle colours, dark→light along aTint
      base: [0.58, 0.58, 0.6],
      mid: [0.82, 0.82, 0.84],
      high: [1, 1, 1],
    },
  },

  /** per-particle physics — the hover "inverse magnet" */
  sim: {
    reach: 0.3,                   // cursor influence radius, plate units
    rest: 0.5,                    // pressure from a resting cursor
    speed: 1.15,                  // pressure per unit of cursor speed
    gain: 0.11,                   // overall strength
    stiffness: [7, 23] as const,  // per-particle spring range
    damping: [2.2, 4.8] as const, // underdamped: a little overshoot on the way home
    jitter: 1.3,                  // ±rad off the radial push
    gainRange: [0.45, 1.55] as const,
    lift: 0.18,                   // breath of motion off the surface
  },

  /** the arrival: a small loose logo spins and grows into place */
  intro: {
    seed: 0.07,                   // scatter around each seat at the start
    scale: 0.32,                  // starting size, share of full
    over: 0.22,                   // how far past the shape it swells
    charge: 0,                    // share of the intro held before growing (0 = none)
    stagger: 0.08,                // s — spread of departures
    duration: 1.8,                // s — flight time
    spinBoost: 10,                // extra spin at t=0, decays to cruise
    spinDecay: 1.5,               // per second
  },

  /** the click strike */
  strike: {
    press: 2.4,                   // blast strength
    spin: 2.6,                    // spin impulse per click
    fluidForce: 2200,
    fluidDye: 0.1,
    fluidRadius: 0.0035,
    /** clicks inside these are not strikes */
    ignore: 'a, button, [data-no-strike]',
  },

  /** the scroll exit: the cube loosens, its particles travel into the letters
   *  of the name — landing behind the outline in the panel below — and hold
   *  there before going out */
  exit: {
    loosen: 1.2,
    spin: 0.04,       // what is left of the cruise rotation once the name is read
    dim: 1,           // it goes out entirely, once the panel has passed
    dip: 0.14,        // a small duck while the particles are in flight
    drift: 0.05,      // a slow wander, so nothing ever looks rigid
  },

  /** the crossing from cube to wordmark */
  morph: {
    stagger: 0.45,    // how much of the run is spent letting particles leave in turn
    hold: 0.86,       // how bright the letters sit behind the outline
  },

  /** the Lusion-style lens: flow map + chromatic post pass on the mark */
  lens: {
    res: 256,
    decay: 0.955,
    radius: 0.11,
    gain: 5,
    strength: 0.045,
    aberration: 0.18,
    maxVel: 0.035,
  },

  /** the fluid behind everything */
  fluid: {
    ambient: false,
    splatForce: 2600,
    splatRadius: 0.0018,
    dyeAmount: 3.6, dyeMax: 0.18,
    velocityDissipation: 1.8,
    densityDissipation: 1.6,
    curl: 5,
    palette: { deep: [0.024, 0.024, 0.024], violet: [0.16, 0.16, 0.17], lav: [0.5, 0.5, 0.52], pale: [0.92, 0.92, 0.93] },
    glow: 0.22, haze: 0.16,
    stars: false,
    aberration: 3,
    shade: 0.5,
    gain: 1.05,
  } satisfies Partial<FluidOptions>,
};

export type HeroConfig = typeof HERO_CONFIG;
