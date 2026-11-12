/* eslint-disable @typescript-eslint/no-explicit-any */
import app from '../src/apiApp';

export default function handler(req: any, res: any) {
  return app(req, res);
}
