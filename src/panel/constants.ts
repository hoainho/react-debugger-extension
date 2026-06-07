/**
 * Timeout constants for UI feedback (spinners, toast-like states).
 * Values tuned for perceived responsiveness without flicker.
 */

/** Feedback duration for short UI actions (scan toggle, dispatch button) */
export const UI_FEEDBACK_SHORT_MS = 800;

/** Feedback duration for medium UI actions (refresh, monitor toggle) */
export const UI_FEEDBACK_MEDIUM_MS = 1000;

/** Feedback for debugger enable/disable — longer because background work continues */
export const DEBUGGER_TOGGLE_FEEDBACK_MS = 3000;

/** Time to wait for Redux store auto-detection */
export const REDUX_SEARCH_TIMEOUT_MS = 5000;

/** Correlation analysis feedback */
export const CORRELATION_FEEDBACK_MS = 3000;

/** Snapshot creation feedback (short — operation is fast) */
export const SNAPSHOT_CREATE_FEEDBACK_MS = 500;
