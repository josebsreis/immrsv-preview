/** The wordmark's letters — IMMRSV without the symbol. One source of truth for
 *  every component that draws them (the plain mark, the inked panel). */
export const LETTERMARK = {
  viewBox: '275 78.3 695.5 85.5',
  paths: [
    'M296.23 78.36H275V163.8H296.23V78.36Z',
    'M373.91 139.3L327.02 78.36H307.11V163.8H328.34V116.65L364.61 163.8H383.21L419.47 116.65V163.8H440.71V78.36H420.79L373.91 139.3Z',
    'M518.38 139.3L471.5 78.36H451.58V163.8H472.81V116.65L509.08 163.8H527.68L563.95 116.65V163.8H585.18V78.36H565.26L518.38 139.3Z',
    'M713.6 131.69V78.35H596.05V163.79H617.28V131.69H675.37L691.42 163.79H715.19L699.14 131.69H713.6ZM692.37 99.59V110.46H617.29V99.59H692.37Z',
    'M724.47 131.69H820.79V142.57H724.47V163.8H842.02V110.46H745.7V99.59H842.02V78.36H724.47V131.69Z',
    'M950.41 78.36L911.67 136.47L872.92 78.36H852.89V89.76L902.25 163.8H921.08L970.44 89.76V78.36H950.41Z',
  ],
  /** the viewBox as numbers, for anything that has to lay out over it */
  box: { x: 275, y: 78.3, w: 695.5, h: 85.5 },
} as const;

/** The symbol alone — the three faces of the cube, with the gaps between them.
 *  Light passes through those gaps, which is what makes it worth eclipsing. */
export const SYMBOL = {
  viewBox: '10 10 184 210',
  box: { x: 10, y: 10, w: 184, h: 210 },
  paths: [
    'M102.31 79.53L129 94.86L184.31 63.11L102.16 15.94L20.27 62.88L75.54 94.87L102.31 79.53Z',
    'M69.41 136.45V106.12L14 74.38V168.58L95.68 216.06V151.72L69.41 136.45Z',
    'M135.17 105.94V136.45L108.6 151.89V216.06L190.28 168.58V74.38L135.17 105.94Z',
  ],
} as const;
