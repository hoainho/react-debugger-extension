const MAX_DEPTH = 5;
const MAX_ARRAY_LENGTH = 50;
const MAX_OBJECT_KEYS = 30;
const MAX_STRING_LENGTH = 500;

export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[Max depth]';
  
  if (value === null) return null;
  if (value === undefined) return undefined;
  
  const type = typeof value;
  
  if (type === 'string') {
    const str = value as string;
    return str.length > MAX_STRING_LENGTH 
      ? str.slice(0, MAX_STRING_LENGTH) + '...' 
      : str;
  }
  
  if (type === 'number' || type === 'boolean') {
    return value;
  }
  
  if (type === 'function') {
    const fn = value as Function;
    return `[Function: ${fn.name || 'anonymous'}]`;
  }
  
  if (type === 'symbol') {
    return `[Symbol: ${(value as symbol).description || ''}]`;
  }
  
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LENGTH) {
      return `[Array(${value.length})]`;
    }
    return value.slice(0, MAX_ARRAY_LENGTH).map(v => sanitizeValue(v, depth + 1));
  }
  
  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    
    if (obj.$$typeof) return '[React Element]';
    if (obj instanceof HTMLElement) return `[${obj.tagName}]`;
    if (obj instanceof Event) return '[Event]';
    if (obj instanceof Error) return `[Error: ${obj.message}]`;
    if (obj instanceof Date) return obj.toISOString();
    if (obj instanceof RegExp) return obj.toString();
    if (obj instanceof Map) return `[Map(${obj.size})]`;
    if (obj instanceof Set) return `[Set(${obj.size})]`;
    if (obj instanceof WeakMap) return '[WeakMap]';
    if (obj instanceof WeakSet) return '[WeakSet]';
    if (obj instanceof Promise) return '[Promise]';
    
    const result: Record<string, unknown> = {};
    const keys = Object.keys(obj).slice(0, MAX_OBJECT_KEYS);
    
    for (const key of keys) {
      try {
        result[key] = sanitizeValue(obj[key], depth + 1);
      } catch {
        result[key] = '[Error reading property]';
      }
    }
    
    if (Object.keys(obj).length > MAX_OBJECT_KEYS) {
      result['...'] = `[${Object.keys(obj).length - MAX_OBJECT_KEYS} more keys]`;
    }
    
    return result;
  }
  
  return String(value);
}

export function getSelector(element: Element | null): string {
  if (!element) return 'unknown';
  
  if (element.id) {
    return `#${element.id}`;
  }
  
  const tag = element.tagName.toLowerCase();
  
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.trim().split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      return `${tag}.${classes.slice(0, 2).join('.')}`;
    }
  }
  
  return tag;
}
