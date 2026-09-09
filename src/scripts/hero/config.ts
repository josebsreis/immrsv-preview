/* ═══════════════════════════════════════════════════════════════════
   Every tunable of the hero in one place. Nothing in the engine carries a
   magic number; everything reads from here, and a page can override any
   part of it when it creates the hero.
   ═══════════════════════════════════════════════════════════════════ */

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
      base: [0.40, 0.42, 0.50],   // the low end runs cool: a cloud of pure
      mid: [0.72, 0.73, 0.78],    //   greys reads as paper, not as light
      high: [1, 1, 1],
    },
    /** how the cloud is read as a volume rather than a sheet */
    depth: {
      near: 7.6,                  // camera distance at which nothing is dimmed
      far: 10.6,                  // …and at which the far side is fully faded
      dim: 0.42,                  // what is left of a point at the back
      focus: 0.42,                // where the lens is sharp, along near→far
      bokeh: 1.3,                 // how much wider a point goes out of focus
      even: 0.45,                 // how far a standing form flattens to one
                                  //   size and tint — 1 is a white mass
      lift: 0.15,                 // and how much brighter it goes
    },
  },

  /** per-particle physics — the hover "inverse magnet" */
  sim: {
    reach: 0.36,                  // cursor influence radius, plate units
    formReach: 1.0,               // …times this while a form stands. A form is
                                  //   twice the cube's size, but the hole has to
                                  //   stay a hole: at 1.9 the cursor took hold of
                                  //   two thirds of the figure and moved all of it
    rest: 0.5,                    // pressure from a resting cursor
    speed: 1.15,                  // pressure per unit of cursor speed
    gain: 0.14,                   // overall strength
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
    press: 3.2,                   // blast strength
    reach: 0.42,                  // how far the blast carries, plate units — it
                                  //   is a punch where the cursor is, not a
                                  //   shove felt by the whole mark
    spin: 0.8,                    // a small turn of the whole mark per click —
                                  //   the blast itself is local, so this stays light
    /** clicks inside these are not strikes */
    ignore: 'a, button, [data-no-strike]',
  },

  /** the scroll exit: the mark lets go, bursts outward and goes out with the
   *  first screen — it belongs to the hero and to nothing after it */
  exit: {
    burst: 7,         // how far the particles are thrown as the hero leaves
    spin: 0.04,       // what is left of the cruise rotation on the way out
    dim: 1,           // and it goes out entirely
  },

  /** the reel: the cloud lets go of the cube and stands as the things the
   *  studios make, then goes back. Fields in code, sampled once — nothing
   *  is downloaded for this. */
  shapes: {
    enabled: true,
    stagger: 0.45,        // share of the crossing spent letting particles leave in
                          //   turn: the cloud shears from one form to the next
                          //   rather than sliding across as a block
    print: 0.85,          // how much of that order is height rather than chance:
                          //   at 1 the form is laid down from the floor up, the
                          //   way a printer would build it
    touch: 0.78,          // how much of the cursor's push survives inside a form:
                          //   a standing form used to hold the cloud so tightly
                          //   that the cursor only rippled it, where the cube
                          //   scattered under the same hand
    flat: 0.75,           // how even the points go as a form resolves
    turntable: 0.85,      // the vertical turn, as a share of the cruise spin
    // seconds: the logo holds while the page settles, then the forms follow
    // one another for as long as you stay on the hero
    beat: { first: 3.6, cross: 1.15, shape: 4.5 },
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

};

export type HeroConfig = typeof HERO_CONFIG;
