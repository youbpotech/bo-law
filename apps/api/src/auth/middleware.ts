import { NextFunction, Request, Response } from 'express'
import { verifyAuthToken } from './token'

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token || !(await verifyAuthToken(token))) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }

  next()
}
