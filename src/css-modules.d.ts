/** Ambient types for CSS Module imports (S4). */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
