/**
 * Component source strings for the stale-closure-async detector (M-D.4).
 * The detector analyzes fn.toString(), so these strings ARE the fixtures.
 * Each includes a `useState` decl so state-name inference finds the variable.
 */

// POSITIVE: async .then() reads `count`, deps [] omits it → stale closure.
export const positivePromise = `function Widget(){
  const [count, setCount] = useState(0);
  const onClick = useCallback(() => {
    fetch('/x').then(() => { console.log(count); });
  }, []);
  return null;
}`;

// POSITIVE: awaited body reads `value`, deps [] omits it.
export const positiveAwait = `function Loader(){
  const [value, setValue] = useState(null);
  useEffect(() => {
    (async () => { await save(value); })();
  }, []);
}`;

// NEGATIVE: `count` is in the deps array → correct, not flagged.
export const negativeInDeps = `function Widget(){
  const [count, setCount] = useState(0);
  const onClick = useCallback(() => {
    fetch('/x').then(() => { console.log(count); });
  }, [count]);
  return null;
}`;

// NEGATIVE: no async operation in the body → not flagged.
export const negativeNoAsync = `function Widget(){
  const [count, setCount] = useState(0);
  const onClick = useCallback(() => { console.log(count); }, []);
  return null;
}`;
