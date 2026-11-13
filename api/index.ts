/* eslint-disable @typescript-eslint/no-explicit-any */
import app from '../src/apiApp';

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('Vercel API handler error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err?.message || 'Internal Server Error' });
    }
  }
}
