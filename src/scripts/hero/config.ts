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
    /* The ceiling on device pixels drawn per CSS pixel. These are not a
       quality setting so much as a match: a 2× display drawn at 1.5× is
       stretched by a third and every point goes soft, which on a tablet
       read as the whole hero being blurred the moment it loaded. Two is the
       common Retina ratio, so nothing on a desktop or a tablet is scaled.
       Phones were held to one and a half on the reasoning that it would not
       be seen at their size — and it was: on a three-times display that is
       every point drawn at half size and stretched, and the cloud read as
       out of focus. They are now drawn at the display's own ratio, up to
       three, and the engine watches its own frame rate: a phone that cannot
       keep up is stepped down to `dprMobileFloor` by way of two (index.ts),
       so the sharpness is spent only where there is the speed to pay for it. */
    dpr: 2,
    dprMobile: 3,
    dprMobileFloor: 1.5,
    /** the slowest average frame, in seconds, a phone may run at before its
     *  resolution is stepped down — about fifty a second */
    slowFrame: 1 / 50,
    ground: 0x060606,             // must match --ground in tokens.css (dark)
    exposure: 1.1,
  },

  mark: {
    thick: 0.075,                 // slab thickness, plate units
    separation: 0.175,            // rest gap between the three plates
    voidCentre: 1 / 3,            // the notch's implied cube centre — the pivot
    perPlate: 1600,               // particles over each face
    edgePerPlate: 800,            // particles along each outline
    pointPx: 20,                  // base point size (× device pixel ratio)
    spin: 0.2,                    // cruise angular speed, rad/s, about the diagonal —
                                  //   at the size it loaded at
    /* The turn is the wind-up. It builds as the cube comes in and keeps
       building while the ball churns, so the burst is released from the top
       of the spin — and then it eases down as the cube opens, until the form
       stands in a frame that is barely turning. Multiples of the cruise at
       either end, and the pace eases between them rather than following the
       size: winding up is slower than letting go. */
    spinShut: 3.2,
    spinOpen: 0.4,
    spinWind: 1.4,                // per second — how quickly it winds up
    spinRelease: 2.6,             // …and how quickly it lets go
    wobble: 0.03,                 // slow tilt so the turn never feels like a loop
    /* A turn at one speed is a turntable. The revolution breathes: its pace
       swells and eases on two slow waves that never line up, so it is always
       a little quicker or slower than a moment ago and never repeats. The
       share of the cruise the waves may add or take. */
    breathe: 0.35,
    tint: {                       // particle colours, dark→light along aTint
      base: [0.72, 0.74, 0.80],   // the low end runs cool: a cloud of pure
      mid: [0.92, 0.92, 0.95],    //   greys reads as paper, not as light.
      high: [1, 1, 1],            //   Lifted again — the cube is white, and
    },                            //   it is depth and growth that take it
                                  //   down, not the colour it starts from.
    /** how the cloud is read as a volume rather than a sheet */
    depth: {
      near: 7.6,                  // camera distance at which nothing is dimmed
      far: 10.6,                  // …and at which the far side is fully faded
      dim: 0.55,                  // what is left of a point at the back
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

  /** The cube opens — by getting bigger, and nothing else. It keeps its
   *  shape, its spacing and its turn; it is simply scaled up around the void.
   *  The particles are the same ones, so as it grows it thins: the closed
   *  cube is solid and the open one is air, out of one movement.
   *
   *  It has no clock of its own. It follows the cloud: out to `rest` as the
   *  cloud gathers, so the cloud is never inside it; the rest of the way out
   *  as a form bursts, with a little overshoot, because a thing being made
   *  should push the room around it; and back in as the form is drawn into
   *  the ball, accelerating, the way the ball takes the form. Snap in, spring
   *  out — the cube is part of the same energy, not a frame that opens for it. */
  open: {
    scale: 3.6,           // how many times its size it stands at, fully open
    rest: 0.08,           // how far along that it comes back to while the cloud
                          //   is a ball — all but shut: the size it loaded at,
                          //   with a hair of room for the ball. The whole swing
                          //   is the breath, closed to open and back.
    fill: 1.75,           // how far past the edge of the screen it may reach —
                          //   well past it: the plates are meant to be around
                          //   the page, not in it, and only their inner corners
                          //   stay in view. The scale is still held back on a
                          //   screen without the room, in proportion.
    reach: 0.85,          // the closed cube's own half-extent across the screen,
                          //   in the mark's units, at the angle it is seen from —
                          //   measured off the projected points, not guessed
    /* The cube's size and the form's collapse are not eased on a curve but
       run on a spring: a weight on the end of it is pulled to where it
       should be, overshoots, and settles. That is what an easing was
       imitating, and the spring does what the imitation could not — it
       anticipates. Going shut it is first flicked the other way, so it
       opens a hair, gathers speed, shuts past its rest, and comes back up.
       `freq` is how quickly it wants to get there (Hz), `damping` how much
       of the bounce survives (1 = none), the kicks are the flick it is
       given at each turn of the reel, as a speed in units a second. */
    spring: {
      freq: 1.05,
      damping: 0.48,
      openKick: 3.5,        // out, as the form blooms
      shutKick: 1.6,        // the anticipation: out first, as the form is taken
    },
    /* The open cube is meant to be barely there: the form in the middle is
       the thing, and three plates at full brightness around it were clutter.
       So as it grows it goes down as well as thin — the points dim per unit
       of scale above one, on top of the density they already lose — and gain
       only a touch of size so they still read as points rather than dust.
       Gentle: the spreading already takes most of it, and this only takes
       the edge off — at full open on a desktop the points sit at about three
       quarters of their strength, and come back up as the cube comes in. */
    fade: 0.12,
    grow: 0.1,
  },

  /** The core: the cloud in the void at the notch, and its own particles —
   *  the cube keeps all of its. It gathers there out of nothing, churns, and
   *  is what every form is made of and what each one goes back to. */
  core: {
    count: 4400,          // how many particles the cloud is
    countMobile: 2400,
    radius: 0.29,         // roughly how far it reaches from the pivot — small:
                          //   a form is drawn back into something tight, and
                          //   bursts out of it
    /* A ball of evenly scattered points reads as a ball — a solid object with
       a skin, which is the one thing this must not be. So it is built as a few
       overlapping clumps of different sizes at different places in the void,
       each with far more points near its middle than at its edge, and the
       whole thing is left lumpy and open. */
    lobes: 6,             // how many clumps
    lobeSpread: 0.55,     // how far their centres wander, as a share of radius
    density: 0.62,        // <1 crowds each clump's middle and leaves stragglers
    flatten: 0.86,        // a touch wider than it is tall
    drift: 0.05,          // how far a particle wanders on its own, mark units —
                          //   two sines a particle, worked out on the GPU, which
                          //   is why the churn costs nothing at this count
    churn: 1.05,          // rad/s at the middle — the outside turns slower
    bands: 10,            // how many speeds that swirl is quantised to
    gather: 1.0,          // s — the cloud coming together out of nothing
    settle: 1.15,         // s — the least it churns there before a form is made
    /* The wind-up, in the cloud: through the settle it draws in on itself —
       to this much smaller — and its churn quickens, so the burst comes out of
       something compressed rather than something at rest. The form then opens
       from that tightened ball, which is what makes it read as a release. */
    squeeze: 0.38,
    patience: 5,          // s — …and the most, if a shape never arrives
    bloom: 0.9,           // s — cloud → form. Fast out of the gate and slow to
                          //   land: a form does not condense, it bursts
    collapse: 0.9,        // s — form → cloud. The same length as the bloom: the
                          //   cube's way in is its way out played backwards
    spread: 0.55,         // share of a crossing spent letting particles go in
                          //   turn, so the cloud blooms rather than snapping
  },

  /** the reel: what the core stands as, and for how long. The forms are fields
   *  and baked clouds in code — nothing is downloaded but the clouds. */
  shapes: {
    enabled: true,
    touch: 0.78,          // how much of the cursor's push survives inside a form:
                          //   a standing form used to hold the cloud so tightly
                          //   that the cursor only rippled it, where the cube
                          //   scattered under the same hand
    flat: 0.75,           // how even the migrated points go as a form resolves
    turn: 0.17,           // rad/s — the cloud and whatever it has made turn on
                          //   the spot inside the frame. The mark holds still;
                          //   this is the only thing in the hero still moving
                          //   of its own accord.
    // seconds: how long after the intro is released the cloud starts to
    // gather, then how long each form stands before it falls back to the
    // cloud. The first is shorter than the cube's flight (intro.duration):
    // the cloud is coming together in the void while the cube is still
    // landing, a beat behind it rather than after a pause — the whole
    // opening reads as one move instead of two
    beat: { first: 1.0, shape: 4.5 },
  },

  /** the Lusion-style lens: a flow map that bends the mark under the cursor.
   *  No colour split: the three channels used to be pulled apart along the
   *  flow, which read as a glitch rather than as glass. */
  lens: {
    res: 256,
    decay: 0.955,
    radius: 0.11,
    gain: 5,
    strength: 0.045,
    aberration: 0,
    maxVel: 0.035,
  },

};

export type HeroConfig = typeof HERO_CONFIG;
