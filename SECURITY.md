# Security Implementation Guide

This document outlines the security measures implemented in the intake form and additional server-side requirements.

## Client-Side Security Measures Implemented

### 1. Input Sanitization
All text inputs are sanitized to prevent XSS attacks:
- HTML entities are escaped (`<`, `>`, `"`, `'`, `/`)
- Input length is limited (names: 100 chars, text areas: 5000 chars)
- Trimming of whitespace

**Note:** Client-side sanitization is NOT sufficient. Server must also sanitize and validate.

### 2. CSRF Protection
The form attempts to retrieve CSRF tokens from:
- Meta tag: `<meta name="csrf-token" content="...">`
- Cookie: `XSRF-TOKEN`

The token is sent in the `X-CSRF-Token` header.

### 3. Secure ID Generation
- Uses `crypto.randomUUID()` when available
- Falls back to `crypto.getRandomValues()` with proper UUID v4 formatting
- **Never** uses predictable values like `Date.now()`

### 4. Type Safety
- File renamed from `.jsx` to `.tsx` for proper TypeScript support
- Explicit type definitions for all data structures
- No unsafe type assertions

### 5. Proper Error Handling
- Replaced `alert()` with UI-based error messages
- Comprehensive error logging
- User-friendly error messages that don't expose system details

### 6. Environment Variables
- API endpoint configurable via `NEXT_PUBLIC_API_ENDPOINT`
- No hardcoded sensitive values

## Required Server-Side Implementation

### 1. Rate Limiting (CRITICAL)
Implement rate limiting on the `/api/intake` endpoint:

```javascript
// Example with express-rate-limit
const rateLimit = require('express-rate-limit');

const intakeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: 'Too many submissions from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/intake', intakeLimiter, async (req, res) => {
  // Handler code
});
```

### 2. Server-Side Validation (CRITICAL)
Never trust client-side validation. Implement all validation on the server:

```javascript
// Example validation
function validateIntakeData(data) {
  const errors = {};

  // Validate required fields
  if (!data.firstName || data.firstName.length > 100) {
    errors.firstName = 'Invalid first name';
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.email = 'Invalid email address';
  }

  // Validate UK phone if provided
  if (data.phone) {
    const ukPhoneRegex = /^(\+44\s?7\d{3}|07\d{3})\s?\d{3}\s?\d{3}$|^(\+44\s?1\d{3}|01\d{3}|\+44\s?2\d{2}|02\d{2})\s?\d{3,4}\s?\d{3,4}$/;
    if (!ukPhoneRegex.test(data.phone)) {
      errors.phone = 'Invalid UK phone number';
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
```

### 3. Input Sanitization (CRITICAL)
Sanitize all inputs on the server:

```javascript
// Example with DOMPurify (for Node.js)
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeInput(input) {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: []
  });
}
```

### 4. CSRF Token Generation
Implement CSRF protection:

```javascript
// Example with csurf middleware
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

// Generate token
app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Protect endpoint
app.post('/api/intake', csrfProtection, async (req, res) => {
  // Handler code
});
```

### 5. Data Encryption (CRITICAL)
Encrypt sensitive data at rest:

```javascript
// Example with crypto module
const crypto = require('crypto');

function encrypt(text, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag.toString('hex')
  };
}
```

### 6. Secure Database Storage
- Use parameterized queries to prevent SQL injection
- Store passwords using bcrypt (if applicable)
- Encrypt PII (Personally Identifiable Information)
- Use separate database credentials with minimal privileges

```javascript
// Example with parameterized queries (PostgreSQL)
const query = `
  INSERT INTO intake_submissions
  (first_name, last_name, email, encrypted_data, created_at)
  VALUES ($1, $2, $3, $4, NOW())
  RETURNING id
`;

const values = [
  sanitize(data.firstName),
  sanitize(data.lastName),
  sanitize(data.email),
  encryptedData
];

await pool.query(query, values);
```

### 7. Logging and Monitoring
Implement comprehensive logging:

```javascript
// Log all submission attempts
logger.info('Intake submission attempt', {
  ip: req.ip,
  timestamp: new Date().toISOString(),
  success: true,
  // Don't log sensitive data!
});

// Monitor for suspicious activity
if (submissionCount > threshold) {
  logger.warn('Unusual submission rate detected', {
    ip: req.ip,
    count: submissionCount
  });
}
```

### 8. HTTPS Only
- Enforce HTTPS in production
- Set secure headers:

```javascript
// Example headers
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});
```

### 9. Idempotency
Handle duplicate submissions:

```javascript
// Store idempotency keys with expiration
const idempotencyKey = req.headers['x-idempotency-key'];

if (idempotencyKey) {
  const existing = await redis.get(`idempotency:${idempotencyKey}`);
  if (existing) {
    return res.status(200).json(JSON.parse(existing));
  }
}

// Process submission...
// Store result with TTL
await redis.setex(
  `idempotency:${idempotencyKey}`,
  3600, // 1 hour
  JSON.stringify(result)
);
```

### 10. Email Verification
Consider implementing email verification for submissions:

```javascript
// Generate verification token
const token = crypto.randomBytes(32).toString('hex');

// Send verification email
await sendVerificationEmail(data.email, token);

// Store pending submission
await db.storePendingSubmission(data, token);
```

## Additional Recommendations

### 1. Content Security Policy
Add a meta tag to your HTML:
```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'">
```

### 2. Privacy Compliance (GDPR/UK GDPR)
- Implement data retention policies
- Provide data deletion mechanisms
- Maintain audit logs
- Implement "right to be forgotten"

### 3. Regular Security Audits
- Conduct periodic penetration testing
- Keep dependencies updated
- Monitor for security vulnerabilities
- Review access logs regularly

### 4. Backup and Recovery
- Regular encrypted backups
- Disaster recovery plan
- Test restoration procedures

### 5. Access Control
- Implement role-based access control (RBAC)
- Use multi-factor authentication for admin access
- Audit all data access

## Environment Variables Required

Create a `.env` file (never commit this to version control):

```env
# API Configuration
NEXT_PUBLIC_API_ENDPOINT=/api/intake
API_SECRET_KEY=your-secret-key-here-use-strong-random-value

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DATABASE_ENCRYPTION_KEY=your-encryption-key-here-32-bytes

# SMTP (for email notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Redis (for rate limiting and caching)
REDIS_URL=redis://localhost:6379

# Security
CSRF_SECRET=your-csrf-secret-here
SESSION_SECRET=your-session-secret-here

# Environment
NODE_ENV=production
```

## Testing Security

### 1. XSS Testing
Try submitting:
- `<script>alert('XSS')</script>`
- `<img src=x onerror=alert('XSS')>`
- `javascript:alert('XSS')`

All should be sanitized.

### 2. SQL Injection Testing
Try submitting:
- `'; DROP TABLE users; --`
- `1' OR '1'='1`

Parameterized queries should prevent these.

### 3. Rate Limiting Testing
- Submit multiple times rapidly
- Should be blocked after threshold

### 4. CSRF Testing
- Try submitting without CSRF token
- Should be rejected

## Compliance Checklist

- [ ] HTTPS enforced
- [ ] Rate limiting implemented
- [ ] Server-side validation
- [ ] Input sanitization
- [ ] CSRF protection
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Encrypted data at rest
- [ ] Encrypted data in transit
- [ ] Audit logging
- [ ] GDPR compliance
- [ ] Regular security updates
- [ ] Backup and recovery plan
- [ ] Incident response plan
- [ ] Privacy policy published
- [ ] Terms of service published

## Support

For security concerns or to report vulnerabilities, contact:
- Email: security@theuid.uk
- Use responsible disclosure practices
