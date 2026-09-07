import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import multer from 'multer';

const env = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SERVER_URL: z.string().url().default('http://localhost:3000')
}).parse(process.env);

const prisma = new PrismaClient();
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use(session({
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(passport.initialize());
app.use(passport.session());

type SessionUser = {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
};

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

declare global {
  namespace Express {
    interface User extends SessionUser {}
  }
}

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${env.SERVER_URL.replace(/\/$/, '')}/api/auth/google/callback`
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('Google account email is unavailable'));
      const user = await prisma.user.upsert({
        where: { googleId: profile.id },
        update: {
          name: profile.displayName,
          email,
          avatarUrl: profile.photos?.[0]?.value ?? null
        },
        create: {
          googleId: profile.id,
          name: profile.displayName,
          email,
          avatarUrl: profile.photos?.[0]?.value ?? null
        }
      });
      done(null, user);
    } catch (error) {
      done(error as Error);
    }
  }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return done(null, false);
    done(null, user);
  } catch (error) {
    done(error as Error);
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
  }
});

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  next();
};

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ONLINE', service: 'NEXA VISION AI V2' }));
app.get('/api/auth/google', (_req, res, next) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ success: false, message: 'Google OAuth is not configured' });
  }
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' }));
app.get('/api/auth/google/callback', passport.authenticate('google', { failureRedirect: `${env.CLIENT_URL}/login` }), (_req, res) => {
  res.redirect(`${env.CLIENT_URL}/app`);
});
app.get('/api/auth/me', (req, res) => res.json({ success: true, user: req.user ?? null }));
app.post('/api/auth/logout', (req, res) => {
  req.logout((error) => {
    if (error) return res.status(500).json({ success: false, message: 'Logout failed' });
    req.session.destroy((destroyError) => {
      if (destroyError) return res.status(500).json({ success: false, message: 'Logout failed' });
      res.clearCookie('connect.sid');
      return res.json({ success: true });
    });
  });
});

app.post('/api/vision/analyze', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Valid JPG, PNG or WEBP image required' });
  if (!env.GEMINI_API_KEY) return res.status(503).json({ success: false, message: 'Vision engine is not configured' });
  try {
    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const prompt = 'Analyze this image for a computer vision product. Return ONLY valid JSON with keys description (string), objects (array of {name:string,confidence:number from 0 to 100}), environment (string), insights (string), confidence (low|medium|high).';
    const response = await fetch(`${endpoint}?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: req.file.mimetype, data: req.file.buffer.toString('base64') } }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });
    if (!response.ok) throw new Error('Gemini request failed');
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = z.object({
      description: z.string(),
      objects: z.array(z.object({ name: z.string(), confidence: z.number().min(0).max(100) })),
      environment: z.string(),
      insights: z.string(),
      confidence: z.enum(['low', 'medium', 'high'])
    }).parse(JSON.parse(text));
    const saved = await prisma.analysis.create({
      data: {
        userId: req.user.id,
        description: parsed.description,
        objects: parsed.objects,
        environment: parsed.environment,
        insights: parsed.insights,
        confidence: parsed.confidence
      }
    });
    return res.json({ ...parsed, success: true, id: saved.id });
  } catch {
    return res.status(502).json({ success: false, message: 'Unable to analyze this image. Try again.' });
  }
});

app.get('/api/analysis', requireAuth, async (req, res) => {
  try {
    const rows = await prisma.analysis.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json({ success: true, items: rows });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to load analysis history' });
  }
});

app.get('/api/analysis/:id', requireAuth, async (req, res) => {
  try {
    const row = await prisma.analysis.findFirst({ where: { id: req.params.id, userId: req.user.id } });
    if (!row) return res.status(404).json({ success: false, message: 'Analysis not found' });
    return res.json({ success: true, item: row });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to load analysis' });
  }
});

app.delete('/api/analysis/:id', requireAuth, async (req, res) => {
  try {
    await prisma.analysis.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: 'Unable to delete analysis' });
  }
});

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('request failure');
  return res.status(500).json({ success: false, message: 'Server error' });
});

const server = app.listen(env.PORT, () => console.log(`NEXA VISION API listening on ${env.PORT}`));
const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
};
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
