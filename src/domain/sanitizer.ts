/**
 * Data Sanitizer & Redactor
 * Enforces zero-leak invariant: Trace, logs, prompts, and audit events never contain raw credentials.
 */

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-_.]+/gi,
  /(?:api[_-]?key|secret|token|password|passwd|auth)[ =:]+['"]?([A-Za-z0-9\-_.]{8,})['"]?/gi,
  /AIza[0-9A-Za-z\-_]{35}/g, // Google API Key
  /sk-[a-zA-Z0-9]{32,}/g,    // OpenAI key
  /ghp_[a-zA-Z0-9]{36}/g,    // GitHub PAT
];

const SECRET_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'secret',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'credential',
  'private_key',
]);

export class DataSanitizer {
  public static sanitizeString(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let sanitized = text;
    for (const pattern of SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match) => {
        if (match.startsWith('Bearer ')) {
          return 'Bearer [REDACTED_TOKEN]';
        }
        return '[REDACTED_CREDENTIAL]';
      });
    }
    return sanitized;
  }

  public static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    if (typeof obj === 'object') {
      const sanitizedObj: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (SECRET_KEYS.has(lowerKey)) {
          sanitizedObj[key] = '[REDACTED]';
        } else {
          sanitizedObj[key] = this.sanitizeObject(value);
        }
      }
      return sanitizedObj;
    }
    return obj;
  }
}
