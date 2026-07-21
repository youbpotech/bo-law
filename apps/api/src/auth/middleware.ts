import { NextFunction, Request, Response } from 'express'
import { verifyAuthToken } from './token'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.header('authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null

  if (!token || !verifyAuthToken(token)) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }

  next()
}
