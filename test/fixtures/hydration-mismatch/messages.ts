/**
 * Representative console.error argument sets for the hydration-mismatch
 * detector (M-C.4). Shared source of truth for
 * src/__tests__/hydration-mismatch.test.ts.
 *
 * POSITIVE = React hydration-failure messages the detector must flag.
 * NEGATIVE = unrelated console.error output the detector must ignore.
 */

export const positiveHydrationErrors: unknown[][] = [
  ['Warning: Text content did not match. Server: "Good morning" Client: "Good evening"', '\n    in Greeting'],
  ['Hydration failed because the initial UI does not match what was rendered on the server.'],
  ['Warning: Expected server HTML to contain a matching <div> in <App>.'],
  ['Text content does not match server-rendered HTML.'],
];

export const negativeErrors: unknown[][] = [
  ['Warning: Each child in a list should have a unique "key" prop.'],
  ['TypeError: Cannot read properties of undefined (reading map)'],
  ['Some app log', { detail: 42 }],
];
