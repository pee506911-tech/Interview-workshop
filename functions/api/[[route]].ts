import { connect } from '@tidbcloud/serverless';

interface Env {
  DB_URL: string;
  JWT_SECRET: string;
  ALLOWED_ORIGIN: string;
  EMAIL_API_URL: string;
  EMAIL_API_SECRET: string;
}

// Rate limiting store (per-worker instance, resets on cold start)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function uuid() {
  return crypto.randomUUID();
}

function json(data: any, status = 200, origin = '*') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json', 
      'Access-Control-Allow-Origin': origin 
    }
  });
}

function getCorsOrigin(request: Request, env: Env): string {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGIN || '*';
  if (allowed === '*') return '*';
  return allowed.split(',').includes(origin) ? origin : allowed.split(',')[0];
}

// Rate limiting: returns true if request should be blocked
function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimits.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  
  record.count++;
  return record.count > maxRequests;
}

function getClientIP(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For')?.split(',')[0] || 
         'unknown';
}

// ============================================================================
// PASSWORD HASHING (using Web Crypto API)
// ============================================================================

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Handle legacy plaintext passwords (for migration)
  if (!stored.includes(':')) {
    return password === stored;
  }
  const [saltHex, hashHex] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const newHashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === newHashHex;
}

// ============================================================================
// JWT TOKEN HANDLING (replaces in-memory sessions)
// ============================================================================

async function createJWT(payload: object, secret: string, expiresInHours = 6): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInHours * 3600 };
  
  const encode = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const headerB64 = encode(header);
  const payloadB64 = encode(fullPayload);
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${headerB64}.${payloadB64}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function verifyJWT(token: string, secret: string): Promise<{ username: string; role: string; name: string } | null> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    if (!headerB64 || !payloadB64 || !sigB64) return null;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(`${headerB64}.${payloadB64}`));
    if (!valid) return null;
    
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    
    return { username: payload.username, role: payload.role, name: payload.name };
  } catch {
    return null;
  }
}

function getToken(request: Request): string | null {
  return request.headers.get('Authorization')?.replace('Bearer ', '') || null;
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function validateString(str: any, minLen = 1, maxLen = 255): boolean {
  return typeof str === 'string' && str.trim().length >= minLen && str.length <= maxLen;
}

function sanitizeString(str: string): string {
  return str.trim().slice(0, 255);
}

// CSRF token generation and validation
async function generateCSRFToken(secret: string, sessionId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = `${sessionId}:${Date.now()}`;
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(`${data}:${sigHex}`);
}

async function validateCSRFToken(token: string, secret: string): Promise<boolean> {
  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length < 3) return false;
    const timestamp = parseInt(parts[1]);
    // Token valid for 6 hours
    if (Date.now() - timestamp > 6 * 60 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// MAIN REQUEST HANDLER
// ============================================================================

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const path = '/' + ((context.params.route as string[]) || []).join('/');
  const method = request.method;
  const corsOrigin = getCorsOrigin(request, env);
  const clientIP = getClientIP(request);

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-CSRF-Token'
      }
    });
  }

  // Rate limiting for sensitive endpoints
  if (path === '/login') {
    if (isRateLimited(`login:${clientIP}`, 5, 60000)) { // 5 attempts per minute
      return json({ error: 'Too many login attempts. Please wait.' }, 429, corsOrigin);
    }
  }
  if (path === '/bookings' && method === 'POST') {
    if (isRateLimited(`booking:${clientIP}`, 10, 60000)) { // 10 bookings per minute
      return json({ error: 'Too many requests. Please slow down.' }, 429, corsOrigin);
    }
  }

  try {
    const db = connect({ url: env.DB_URL });
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.length < 32) {
      return json({ error: 'Server configuration error' }, 500, corsOrigin);
    }

    // GET /api/subjects
    if (method === 'GET' && path === '/subjects') {
      const result = await db.execute('SELECT id, name, teacher, custom_fields, description, color, location, active FROM subjects WHERE active = 1 OR active IS NULL ORDER BY name');
      const rows = Array.isArray(result) ? result : (result.rows || []);
      return json(rows.map((r: any) => {
        let customFields = [];
        try { if (r.custom_fields) customFields = JSON.parse(r.custom_fields); } catch {}
        return {
          id: r.id, name: r.name, teacher: r.teacher, customFields,
          description: r.description || '', color: r.color || '#4F46E5', location: r.location || ''
        };
      }), 200, corsOrigin);
    }

    // GET /api/slots/:subjectId
    if (method === 'GET' && path.startsWith('/slots/')) {
      const subjectId = path.split('/')[2];
      if (!validateString(subjectId, 1, 36)) return json({ error: 'Invalid subject ID' }, 400, corsOrigin);
      const result = await db.execute(
        'SELECT id, subject_id, start_time, duration, max_capacity, current_bookings FROM slots WHERE subject_id = ? AND start_time > NOW() ORDER BY start_time',
        [subjectId]
      );
      const rows = Array.isArray(result) ? result : (result.rows || []);
      // Helper to convert DB timestamp (stored as UTC) to ISO string
      const toUTCISOString = (dbTime: any) => {
        if (!dbTime) return null;
        const timeStr = dbTime instanceof Date ? dbTime.toISOString() : String(dbTime);
        if (timeStr.includes('T') && timeStr.endsWith('Z')) return timeStr;
        if (timeStr.includes('T')) return timeStr + 'Z';
        return timeStr.replace(' ', 'T') + 'Z';
      };
      return json(rows.map((r: any) => ({
        id: r.id, subjectId: r.subject_id, startTime: toUTCISOString(r.start_time),
        duration: r.duration, maxCapacity: r.max_capacity, currentBookings: r.current_bookings
      })), 200, corsOrigin);
    }

    // POST /api/bookings
    if (method === 'POST' && path === '/bookings') {
      const data = await request.json() as any;
      
      // Validate required fields
      if (!validateString(data.slotId, 1, 36) || !validateString(data.subjectId, 1, 36)) {
        return json({ error: 'Invalid slot or subject ID' }, 400, corsOrigin);
      }
      if (!validateString(data.studentName, 2, 255)) {
        return json({ error: 'Student name must be 2-255 characters' }, 400, corsOrigin);
      }
      if (!validateString(data.studentId, 1, 100)) {
        return json({ error: 'Invalid student ID' }, 400, corsOrigin);
      }
      if (!validateEmail(data.studentEmail)) {
        return json({ error: 'Invalid email address' }, 400, corsOrigin);
      }
      
      const studentName = sanitizeString(data.studentName);
      const studentId = sanitizeString(data.studentId);
      const studentEmail = sanitizeString(data.studentEmail);
      
      // Check duplicate booking
      const existingBooking = await db.execute(
        'SELECT id FROM bookings WHERE slot_id = ? AND student_id = ?',
        [data.slotId, studentId]
      );
      const existingRows = Array.isArray(existingBooking) ? existingBooking : (existingBooking.rows || []);
      if (existingRows.length > 0) {
        return json({ error: 'You have already booked this slot' }, 400, corsOrigin);
      }
      
      // Check slot availability
      const slotCheck = await db.execute(
        'SELECT id, max_capacity, current_bookings FROM slots WHERE id = ?',
        [data.slotId]
      );
      const slotRows = Array.isArray(slotCheck) ? slotCheck : (slotCheck.rows || []);
      const slot = slotRows[0] as any;
      
      if (!slot) return json({ error: 'Slot no longer exists' }, 400, corsOrigin);
      if (slot.current_bookings >= slot.max_capacity) {
        return json({ error: 'Sorry, this slot is fully booked!' }, 409, corsOrigin);
      }

      // Atomic update with optimistic locking
      await db.execute(
        `UPDATE slots SET current_bookings = current_bookings + 1 
         WHERE id = ? AND current_bookings = ? AND current_bookings < max_capacity`,
        [data.slotId, slot.current_bookings]
      );
      
      const verifyResult = await db.execute('SELECT current_bookings FROM slots WHERE id = ?', [data.slotId]);
      const verifyRows = Array.isArray(verifyResult) ? verifyResult : (verifyResult.rows || []);
      const updatedSlot = verifyRows[0] as any;
      
      if (!updatedSlot || updatedSlot.current_bookings <= slot.current_bookings) {
        return json({ error: 'Sorry, this slot just got fully booked!' }, 409, corsOrigin);
      }
      
      const bookingId = uuid();
      try {
        await db.execute(
          `INSERT INTO bookings (id, slot_id, subject_id, student_name, student_id, student_email, custom_answers, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
          [bookingId, data.slotId, data.subjectId, studentName, studentId, studentEmail, JSON.stringify(data.customAnswers || {})]
        );
      } catch (insertError) {
        await db.execute('UPDATE slots SET current_bookings = GREATEST(current_bookings - 1, 0) WHERE id = ?', [data.slotId]);
        throw insertError;
      }
      
      // Send confirmation email (non-blocking)
      if (env.EMAIL_API_URL && env.EMAIL_API_SECRET) {
        // Get slot and subject details for email
        const slotDetails = await db.execute(
          'SELECT sl.start_time, sl.duration, sl.location, s.name as subject_name FROM slots sl JOIN subjects s ON sl.subject_id = s.id WHERE sl.id = ?',
          [data.slotId]
        );
        const slotInfo = (Array.isArray(slotDetails) ? slotDetails : (slotDetails.rows || []))[0] as any;
        
        if (slotInfo) {
          const slotDate = new Date(slotInfo.start_time);
          // Fire and forget - don't block the response
          fetch(env.EMAIL_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              secret: env.EMAIL_API_SECRET,
              to: studentEmail,
              studentName,
              subjectName: slotInfo.subject_name,
              slotDate: slotDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              slotTime: slotDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              duration: slotInfo.duration,
              location: slotInfo.location || '',
              bookingId
            })
          }).catch(() => {}); // Ignore email errors
        }
      }
      
      return json({ success: true, bookingId }, 200, corsOrigin);
    }

    // POST /api/login
    if (method === 'POST' && path === '/login') {
      const { username, password } = await request.json() as any;
      
      if (!validateString(username, 1, 100) || !validateString(password, 1, 255)) {
        return json({ error: 'Invalid credentials' }, 401, corsOrigin);
      }
      
      const result = await db.execute(
        'SELECT id, username, password, role, name FROM users WHERE username = ?',
        [sanitizeString(username)]
      );
      const rows = Array.isArray(result) ? result : (result.rows || []);
      const user = rows[0] as any;
      
      if (!user) {
        return json({ error: 'Invalid credentials' }, 401, corsOrigin);
      }
      
      const passwordValid = await verifyPassword(password, user.password);
      if (!passwordValid) {
        return json({ error: 'Invalid credentials' }, 401, corsOrigin);
      }
      
      // Upgrade plaintext password to hashed on successful login
      if (!user.password.includes(':')) {
        const hashedPassword = await hashPassword(password);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
      }
      
      const token = await createJWT(
        { username: user.username, role: user.role, name: user.name },
        jwtSecret
      );
      
      return json({ token, name: user.name, role: user.role }, 200, corsOrigin);
    }

    // Auth check helper
    const authCheck = async () => {
      const token = getToken(request);
      if (!token) return null;
      return await verifyJWT(token, jwtSecret);
    };

    // Protected routes
    const user = await authCheck();
    if (!user && path.startsWith('/staff')) {
      return json({ error: 'Unauthorized' }, 401, corsOrigin);
    }

    // GET /api/staff/data
    if (method === 'GET' && path === '/staff/data') {
      const bookingsResult = await db.execute(`
        SELECT b.id, b.student_name, b.student_id, b.student_email, b.custom_answers, b.status, b.created_at,
               s.name as subject_name, sl.start_time, sl.duration
        FROM bookings b
        LEFT JOIN subjects s ON b.subject_id = s.id
        LEFT JOIN slots sl ON b.slot_id = sl.id
        ORDER BY b.created_at DESC
      `);
      const bookingsRows = Array.isArray(bookingsResult) ? bookingsResult : (bookingsResult.rows || []);
      
      const subjectsResult = await db.execute('SELECT id, name, teacher, custom_fields, description, color, location, active FROM subjects ORDER BY name');
      const subjectsRows = Array.isArray(subjectsResult) ? subjectsResult : (subjectsResult.rows || []);
      
      // Helper to convert DB timestamp (stored as UTC) to ISO string
      const toUTCISOString = (dbTime: any) => {
        if (!dbTime) return null;
        // If it's already a string without Z, append Z to indicate UTC
        const timeStr = dbTime instanceof Date ? dbTime.toISOString() : String(dbTime);
        if (timeStr.includes('T') && !timeStr.endsWith('Z')) {
          return timeStr + 'Z';
        }
        if (!timeStr.includes('T')) {
          // Format: "2024-12-19 02:52:00" -> "2024-12-19T02:52:00Z"
          return timeStr.replace(' ', 'T') + 'Z';
        }
        return timeStr;
      };
      
      return json({
        roster: bookingsRows.map((b: any) => ({
          id: b.id, studentName: b.student_name, studentId: b.student_id, studentEmail: b.student_email,
          subjectName: b.subject_name || 'Unknown', 
          slotStart: toUTCISOString(b.start_time),
          slotDuration: b.duration || 0,
          createdAt: toUTCISOString(b.created_at),
          status: b.status, answers: b.custom_answers
        })),
        subjects: subjectsRows.map((s: any) => {
          let customFields = [];
          try { if (s.custom_fields) customFields = JSON.parse(s.custom_fields); } catch {}
          return { 
            id: s.id, name: s.name, teacher: s.teacher, customFields,
            description: s.description || '', color: s.color || '#4F46E5',
            location: s.location || '', active: s.active !== 0
          };
        }),
        user: { name: user!.name, role: user!.role }
      }, 200, corsOrigin);
    }

    // POST /api/staff/subjects
    if (method === 'POST' && path === '/staff/subjects') {
      const { name, teacher, customFields, description, color, location, active } = await request.json() as any;
      if (!validateString(name, 1, 255)) return json({ error: 'Invalid subject name' }, 400, corsOrigin);
      await db.execute(
        'INSERT INTO subjects (id, name, teacher, custom_fields, description, color, location, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uuid(), sanitizeString(name), sanitizeString(teacher || ''), JSON.stringify(customFields || []), 
         sanitizeString(description || ''), color || '#4F46E5', sanitizeString(location || ''), active !== false ? 1 : 0]
      );
      return json({ success: true }, 200, corsOrigin);
    }

    // POST /api/staff/slots - Create single slot
    if (method === 'POST' && path === '/staff/slots') {
      const { subjectId, startTime, duration, maxCapacity, location } = await request.json() as any;
      if (!validateString(subjectId, 1, 36)) return json({ error: 'Invalid subject ID' }, 400, corsOrigin);
      if (!startTime) return json({ error: 'Start time required' }, 400, corsOrigin);
      
      const slotId = uuid();
      await db.execute(
        'INSERT INTO slots (id, subject_id, start_time, duration, max_capacity, current_bookings, location) VALUES (?, ?, ?, ?, ?, 0, ?)',
        [slotId, subjectId, new Date(startTime).toISOString().slice(0, 19).replace('T', ' '), duration || 20, maxCapacity || 1, sanitizeString(location || '')]
      );
      return json({ success: true, id: slotId }, 200, corsOrigin);
    }

    // POST /api/staff/slots/generate - Batch insert optimization
    // Supports: multiple dates OR recurring pattern, multiple time ranges
    // NOTE: All times are treated as local time strings - no timezone conversion
    if (method === 'POST' && path === '/staff/slots/generate') {
      const req = await request.json() as any;
      const { subjectId, dates, startDate, endDate, timeRanges, startTime, endTime, duration, capacity, days, breakTime, location, lunchBreak } = req;
      
      if (!validateString(subjectId, 1, 36)) return json({ error: 'Invalid subject ID' }, 400, corsOrigin);
      
      // Support both old format (startTime/endTime) and new format (timeRanges)
      const ranges = timeRanges && timeRanges.length > 0 
        ? timeRanges 
        : [{ startTime: startTime || '09:00', endTime: endTime || '17:00' }];
      
      // Parse time string "HH:MM" to minutes since midnight
      const parseTimeToMinutes = (timeStr: string): number => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };
      
      // Format minutes since midnight to "HH:MM:SS"
      const minutesToTimeStr = (mins: number): string => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      };
      
      let lunchStartMin = 0, lunchEndMin = 0;
      if (lunchBreak?.start && lunchBreak?.end) {
        lunchStartMin = parseTimeToMinutes(lunchBreak.start);
        lunchEndMin = parseTimeToMinutes(lunchBreak.end);
      }
      
      // Parse date string "YYYY-MM-DD" to components
      const parseDateStr = (dateStr: string): { year: number; month: number; day: number } | null => {
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!match) return null;
        return { year: parseInt(match[1]), month: parseInt(match[2]), day: parseInt(match[3]) };
      };
      
      // Get day of week for a date (0=Sunday, 6=Saturday)
      const getDayOfWeek = (year: number, month: number, day: number): number => {
        // Zeller's formula for Gregorian calendar
        if (month < 3) { month += 12; year--; }
        const q = day;
        const m = month;
        const k = year % 100;
        const j = Math.floor(year / 100);
        const h = (q + Math.floor((13 * (m + 1)) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7;
        return ((h + 6) % 7); // Convert to 0=Sunday
      };
      
      // Add days to a date
      const addDays = (year: number, month: number, day: number, daysToAdd: number): { year: number; month: number; day: number } => {
        const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        // Leap year check
        if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) daysInMonth[2] = 29;
        
        day += daysToAdd;
        while (day > daysInMonth[month]) {
          day -= daysInMonth[month];
          month++;
          if (month > 12) { month = 1; year++; daysInMonth[2] = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 29 : 28; }
        }
        return { year, month, day };
      };
      
      // Compare two dates
      const compareDates = (a: { year: number; month: number; day: number }, b: { year: number; month: number; day: number }): number => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      };
      
      // Collect target dates as strings "YYYY-MM-DD"
      let targetDateStrs: string[] = [];
      
      if (dates && Array.isArray(dates) && dates.length > 0) {
        // Multiple specific dates mode
        targetDateStrs = dates.filter((d: string) => d && parseDateStr(d));
      } else if (startDate) {
        // Recurring mode
        const start = parseDateStr(startDate);
        const end = endDate ? parseDateStr(endDate) : start;
        if (!start || !end) return json({ error: 'Invalid date format' }, 400, corsOrigin);
        
        let current = { ...start };
        while (compareDates(current, end) <= 0) {
          const dow = getDayOfWeek(current.year, current.month, current.day);
          if (!days || days.length === 0 || days.includes(dow)) {
            targetDateStrs.push(`${current.year}-${String(current.month).padStart(2, '0')}-${String(current.day).padStart(2, '0')}`);
          }
          current = addDays(current.year, current.month, current.day, 1);
        }
      }
      
      if (targetDateStrs.length === 0) return json({ error: 'No valid dates provided' }, 400, corsOrigin);
      
      const slots: any[] = [];
      const slotInterval = duration + (breakTime || 0);

      for (const dateStr of targetDateStrs) {
        // Generate slots for each time range
        for (const range of ranges) {
          const startMin = parseTimeToMinutes(range.startTime);
          const endMin = parseTimeToMinutes(range.endTime);
          
          let currMin = startMin;
          
          while (currMin + duration <= endMin) {
            const slotEndMin = currMin + duration;
            
            // Skip lunch break
            if (lunchBreak && lunchStartMin && lunchEndMin && currMin < lunchEndMin && slotEndMin > lunchStartMin) {
              currMin = lunchEndMin;
              continue;
            }
            
            // Create slot timestamp as "YYYY-MM-DD HH:MM:SS" (stored as-is, no timezone)
            const slotTimestamp = `${dateStr} ${minutesToTimeStr(currMin)}`;
            slots.push([uuid(), subjectId, slotTimestamp, duration, capacity, 0, sanitizeString(location || '')]);
            
            currMin += slotInterval;
          }
        }
      }
      
      if (slots.length === 0) return json({ error: 'No slots generated' }, 400, corsOrigin);
      
      // Batch insert: build multi-row INSERT for better performance
      const BATCH_SIZE = 50;
      for (let i = 0; i < slots.length; i += BATCH_SIZE) {
        const batch = slots.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = batch.flat();
        await db.execute(
          `INSERT INTO slots (id, subject_id, start_time, duration, max_capacity, current_bookings, location) VALUES ${placeholders}`,
          values
        );
      }
      
      return json({ success: true, count: slots.length }, 200, corsOrigin);
    }

    // DELETE /api/staff/bookings/:id
    if (method === 'DELETE' && path.startsWith('/staff/bookings/')) {
      const bookingId = path.split('/')[3];
      if (!validateString(bookingId, 1, 36)) return json({ error: 'Invalid booking ID' }, 400, corsOrigin);
      
      const bookingsResult = await db.execute('SELECT slot_id FROM bookings WHERE id = ?', [bookingId]);
      const bookingsRows = Array.isArray(bookingsResult) ? bookingsResult : (bookingsResult.rows || []);
      const booking = bookingsRows[0] as any;
      
      if (!booking) return json({ error: 'Booking not found' }, 404, corsOrigin);
      
      await db.execute('DELETE FROM bookings WHERE id = ?', [bookingId]);
      await db.execute('UPDATE slots SET current_bookings = GREATEST(current_bookings - 1, 0) WHERE id = ?', [booking.slot_id]);
      
      return json({ success: true }, 200, corsOrigin);
    }

    // PUT /api/staff/subjects/:id
    if (method === 'PUT' && path.match(/^\/staff\/subjects\/[^/]+$/)) {
      const subjectId = path.split('/')[3];
      if (!validateString(subjectId, 1, 36)) return json({ error: 'Invalid subject ID' }, 400, corsOrigin);
      const { name, teacher, customFields, description, color, location, active } = await request.json() as any;
      if (!validateString(name, 1, 255)) return json({ error: 'Invalid subject name' }, 400, corsOrigin);
      await db.execute(
        'UPDATE subjects SET name = ?, teacher = ?, custom_fields = ?, description = ?, color = ?, location = ?, active = ? WHERE id = ?',
        [sanitizeString(name), sanitizeString(teacher || ''), JSON.stringify(customFields || []), 
         sanitizeString(description || ''), color || '#4F46E5', sanitizeString(location || ''), active !== false ? 1 : 0, subjectId]
      );
      return json({ success: true }, 200, corsOrigin);
    }

    // DELETE /api/staff/subjects/:id
    if (method === 'DELETE' && path.match(/^\/staff\/subjects\/[^/]+$/)) {
      const subjectId = path.split('/')[3];
      if (!validateString(subjectId, 1, 36)) return json({ error: 'Invalid subject ID' }, 400, corsOrigin);
      await db.execute('DELETE FROM bookings WHERE subject_id = ?', [subjectId]);
      await db.execute('DELETE FROM slots WHERE subject_id = ?', [subjectId]);
      await db.execute('DELETE FROM subjects WHERE id = ?', [subjectId]);
      return json({ success: true }, 200, corsOrigin);
    }

    // GET /api/staff/slots
    if (method === 'GET' && path === '/staff/slots') {
      const url = new URL(request.url);
      const subjectId = url.searchParams.get('subjectId');
      const showPast = url.searchParams.get('showPast') === 'true';
      const dateFrom = url.searchParams.get('dateFrom');
      const dateTo = url.searchParams.get('dateTo');
      const availableOnly = url.searchParams.get('availableOnly') === 'true';
      
      let query = `SELECT sl.*, s.name as subject_name, s.teacher FROM slots sl LEFT JOIN subjects s ON sl.subject_id = s.id`;
      const params: any[] = [];
      const conditions: string[] = [];
      
      if (subjectId && validateString(subjectId, 1, 36)) {
        conditions.push('sl.subject_id = ?');
        params.push(subjectId);
      }
      if (!showPast) conditions.push('sl.start_time > NOW()');
      if (dateFrom) { conditions.push('DATE(sl.start_time) >= ?'); params.push(dateFrom); }
      if (dateTo) { conditions.push('DATE(sl.start_time) <= ?'); params.push(dateTo); }
      if (availableOnly) conditions.push('sl.current_bookings < sl.max_capacity');
      
      if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
      query += ' ORDER BY sl.start_time ASC';
      
      const result = await db.execute(query, params);
      const rows = Array.isArray(result) ? result : (result.rows || []);
      
      // Helper to convert DB timestamp (stored as UTC) to ISO string
      const toUTCISOString = (dbTime: any) => {
        if (!dbTime) return null;
        const timeStr = dbTime instanceof Date ? dbTime.toISOString() : String(dbTime);
        // If already has T and Z, return as-is
        if (timeStr.includes('T') && timeStr.endsWith('Z')) return timeStr;
        // If has T but no Z, append Z
        if (timeStr.includes('T')) return timeStr + 'Z';
        // Format: "2024-12-19 02:52:00" -> "2024-12-19T02:52:00Z"
        return timeStr.replace(' ', 'T') + 'Z';
      };
      
      return json(rows.map((r: any) => ({
        id: r.id, subjectId: r.subject_id, subjectName: r.subject_name, teacher: r.teacher,
        startTime: toUTCISOString(r.start_time), duration: r.duration,
        maxCapacity: r.max_capacity, currentBookings: r.current_bookings, location: r.location || ''
      })), 200, corsOrigin);
    }

    // DELETE /api/staff/slots/:id
    if (method === 'DELETE' && path.match(/^\/staff\/slots\/[^/]+$/)) {
      const slotId = path.split('/')[3];
      if (!validateString(slotId, 1, 36)) return json({ error: 'Invalid slot ID' }, 400, corsOrigin);
      await db.execute('DELETE FROM bookings WHERE slot_id = ?', [slotId]);
      await db.execute('DELETE FROM slots WHERE id = ?', [slotId]);
      return json({ success: true }, 200, corsOrigin);
    }

    // PUT /api/staff/slots/:id
    if (method === 'PUT' && path.match(/^\/staff\/slots\/[^/]+$/)) {
      const slotId = path.split('/')[3];
      if (!validateString(slotId, 1, 36)) return json({ error: 'Invalid slot ID' }, 400, corsOrigin);
      const { maxCapacity, startTime, duration, location, subjectId } = await request.json() as any;
      
      const updates: string[] = [];
      const params: any[] = [];
      
      if (maxCapacity !== undefined) { updates.push('max_capacity = ?'); params.push(maxCapacity); }
      if (startTime) { updates.push('start_time = ?'); params.push(new Date(startTime).toISOString().slice(0, 19).replace('T', ' ')); }
      if (duration !== undefined) { updates.push('duration = ?'); params.push(duration); }
      if (location !== undefined) { updates.push('location = ?'); params.push(sanitizeString(location)); }
      if (subjectId !== undefined) { updates.push('subject_id = ?'); params.push(subjectId); }
      
      if (updates.length > 0) {
        params.push(slotId);
        await db.execute(`UPDATE slots SET ${updates.join(', ')} WHERE id = ?`, params);
      }
      return json({ success: true }, 200, corsOrigin);
    }

    // POST /api/staff/slots/bulk-delete
    if (method === 'POST' && path === '/staff/slots/bulk-delete') {
      const { slotIds } = await request.json() as any;
      if (!Array.isArray(slotIds)) return json({ error: 'Invalid slot IDs' }, 400, corsOrigin);
      for (const id of slotIds) {
        if (!validateString(id, 1, 36)) continue;
        await db.execute('DELETE FROM bookings WHERE slot_id = ?', [id]);
        await db.execute('DELETE FROM slots WHERE id = ?', [id]);
      }
      return json({ success: true, count: slotIds.length }, 200, corsOrigin);
    }

    // GET /api/staff/users
    if (method === 'GET' && path === '/staff/users') {
      const result = await db.execute('SELECT id, username, role, name, email, created_at FROM users ORDER BY created_at DESC');
      const rows = Array.isArray(result) ? result : (result.rows || []);
      return json(rows, 200, corsOrigin);
    }

    // POST /api/staff/users
    if (method === 'POST' && path === '/staff/users') {
      const { username, password, name, role, email } = await request.json() as any;
      
      if (!validateString(username, 3, 100)) return json({ error: 'Username must be 3-100 characters' }, 400, corsOrigin);
      if (!validateString(password, 8, 255)) return json({ error: 'Password must be at least 8 characters' }, 400, corsOrigin);
      if (!validateString(name, 1, 255)) return json({ error: 'Name is required' }, 400, corsOrigin);
      if (email && !validateEmail(email)) return json({ error: 'Invalid email' }, 400, corsOrigin);
      
      const existing = await db.execute('SELECT id FROM users WHERE username = ?', [sanitizeString(username)]);
      const existingRows = Array.isArray(existing) ? existing : (existing.rows || []);
      if (existingRows.length > 0) return json({ error: 'Username already exists' }, 400, corsOrigin);
      
      const hashedPassword = await hashPassword(password);
      await db.execute(
        'INSERT INTO users (id, username, password, name, role, email) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid(), sanitizeString(username), hashedPassword, sanitizeString(name), role || 'staff', sanitizeString(email || '')]
      );
      return json({ success: true }, 200, corsOrigin);
    }

    // PUT /api/staff/users/:id
    if (method === 'PUT' && path.match(/^\/staff\/users\/[^/]+$/)) {
      const userId = path.split('/')[3];
      if (!validateString(userId, 1, 36)) return json({ error: 'Invalid user ID' }, 400, corsOrigin);
      const { name, role, email, password } = await request.json() as any;
      
      if (!validateString(name, 1, 255)) return json({ error: 'Name is required' }, 400, corsOrigin);
      if (email && !validateEmail(email)) return json({ error: 'Invalid email' }, 400, corsOrigin);
      
      if (password) {
        if (!validateString(password, 8, 255)) return json({ error: 'Password must be at least 8 characters' }, 400, corsOrigin);
        const hashedPassword = await hashPassword(password);
        await db.execute(
          'UPDATE users SET name = ?, role = ?, email = ?, password = ? WHERE id = ?',
          [sanitizeString(name), role || 'staff', sanitizeString(email || ''), hashedPassword, userId]
        );
      } else {
        await db.execute(
          'UPDATE users SET name = ?, role = ?, email = ? WHERE id = ?',
          [sanitizeString(name), role || 'staff', sanitizeString(email || ''), userId]
        );
      }
      return json({ success: true }, 200, corsOrigin);
    }

    // PUT /api/staff/bookings/:id
    if (method === 'PUT' && path.match(/^\/staff\/bookings\/[^/]+$/)) {
      const bookingId = path.split('/')[3];
      if (!validateString(bookingId, 1, 36)) return json({ error: 'Invalid booking ID' }, 400, corsOrigin);
      const { status } = await request.json() as any;
      if (!validateString(status, 1, 50)) return json({ error: 'Invalid status' }, 400, corsOrigin);
      await db.execute('UPDATE bookings SET status = ? WHERE id = ?', [sanitizeString(status), bookingId]);
      return json({ success: true }, 200, corsOrigin);
    }

    // POST /api/staff/clear-bookings
    if (method === 'POST' && path === '/staff/clear-bookings') {
      await db.execute('DELETE FROM bookings');
      await db.execute('UPDATE slots SET current_bookings = 0');
      return json({ success: true }, 200, corsOrigin);
    }

    // POST /api/staff/clear-past-slots
    if (method === 'POST' && path === '/staff/clear-past-slots') {
      await db.execute('DELETE FROM bookings WHERE slot_id IN (SELECT id FROM slots WHERE start_time < NOW())');
      await db.execute('DELETE FROM slots WHERE start_time < NOW()');
      return json({ success: true }, 200, corsOrigin);
    }

    // GET /api/staff/logs
    if (method === 'GET' && path === '/staff/logs') {
      const result = await db.execute(`
        SELECT b.id, b.student_name, b.status, b.created_at, s.name as subject_name
        FROM bookings b LEFT JOIN subjects s ON b.subject_id = s.id
        ORDER BY b.created_at DESC LIMIT 50
      `);
      const rows = Array.isArray(result) ? result : (result.rows || []);
      return json(rows.map((r: any) => ({
        id: r.id, type: 'booking', message: `${r.student_name} booked ${r.subject_name}`,
        user: r.student_name, timestamp: r.created_at
      })), 200, corsOrigin);
    }

    // DELETE /api/staff/users/:id
    if (method === 'DELETE' && path.match(/^\/staff\/users\/[^/]+$/)) {
      const userId = path.split('/')[3];
      if (!validateString(userId, 1, 36)) return json({ error: 'Invalid user ID' }, 400, corsOrigin);
      await db.execute('DELETE FROM users WHERE id = ?', [userId]);
      return json({ success: true }, 200, corsOrigin);
    }

    // GET /api/staff/stats
    if (method === 'GET' && path === '/staff/stats') {
      const totalBookings = await db.execute('SELECT COUNT(*) as count FROM bookings');
      const todayBookings = await db.execute("SELECT COUNT(*) as count FROM bookings WHERE DATE(created_at) = CURDATE()");
      const totalSubjects = await db.execute('SELECT COUNT(*) as count FROM subjects');
      const upcomingSlots = await db.execute('SELECT COUNT(*) as count FROM slots WHERE start_time > NOW()');
      const availableSlots = await db.execute('SELECT COUNT(*) as count FROM slots WHERE start_time > NOW() AND current_bookings < max_capacity');
      
      const getCount = (r: any) => {
        const rows = Array.isArray(r) ? r : (r.rows || []);
        return rows[0]?.count || 0;
      };
      
      return json({
        totalBookings: getCount(totalBookings),
        todayBookings: getCount(todayBookings),
        totalSubjects: getCount(totalSubjects),
        upcomingSlots: getCount(upcomingSlots),
        availableSlots: getCount(availableSlots)
      }, 200, corsOrigin);
    }

    return json({ error: 'Not found' }, 404, corsOrigin);

  } catch (e: any) {
    console.error(e);
    return json({ error: 'Server error' }, 500, getCorsOrigin(request, env));
  }
};
