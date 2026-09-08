/** Keep in sync with the comment block at the end of src/styles/tokens.css. */
export const BP = {
  mobile: 719,
  tablet: 859,
  wide: 1099,
} as const;

export const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= BP.mobile;
