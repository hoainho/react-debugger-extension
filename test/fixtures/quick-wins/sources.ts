/**
 * Fixture sources for the M-F.1 quick-win detectors.
 * ref-mutation analyzes fn.toString(); these strings ARE the fixtures.
 */

// POSITIVE: mutates ref.current in the render body (no effect) → flagged.
export const refMutationInRender = `function Comp(){
  const ref = useRef(0);
  ref.current = ref.current + 1;
  return null;
}`;

// NEGATIVE: mutates ref.current INSIDE a useEffect → legitimate, not flagged.
export const refMutationInEffect = `function Comp(){
  const ref = useRef(0);
  useEffect(() => { ref.current = Date.now(); }, []);
  return null;
}`;

// NEGATIVE: mutation inside a DEPS-LESS effect (runs every commit) → still legit,
// must not be flagged (regression guard for the optional-deps EFFECT_RE fix).
export const refMutationInEffectNoDeps = `function Comp(){
  const ref = useRef(0);
  useEffect(() => { ref.current = Date.now(); });
  return null;
}`;
