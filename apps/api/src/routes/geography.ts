import { Router } from 'express'
import { requireResourceUser } from '../auth/current-user'
import { requireAuth } from '../auth/middleware'
import { AppDataSource } from '../data-source'

export const geographyRouter = Router()
const CUSTOM_VALUE = /^C:(\d+)$/i

function searchTerm(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 100) : ''
}

function customId(value: string): number | null {
  const id = Number(value.match(CUSTOM_VALUE)?.[1])
  return Number.isInteger(id) && id > 0 ? id : null
}

geographyRouter.get('/geography/countries', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'clients')
  if (!user) return
  const query = searchTerm(req.query.q)
  const result = await AppDataSource.query(
    `
      SELECT value, label, custom
      FROM (
        SELECT c.iso2::text AS value,
          COALESCE(NULLIF(c.translations::jsonb->>'pt', ''), c.name) AS label,
          false AS custom
        FROM public.countries c
        WHERE c.flag = 1
          AND ($1 = '' OR c.name ILIKE '%' || $1 || '%'
            OR c.native ILIKE '%' || $1 || '%'
            OR c.iso2 ILIKE $1 || '%'
            OR c.translations::jsonb->>'pt' ILIKE '%' || $1 || '%')
        UNION ALL
        SELECT 'C:' || c.id, c.name, true
        FROM bo.custom_countries c
        WHERE c.company_id = $2
          AND ($1 = '' OR c.name ILIKE '%' || $1 || '%')
      ) options
      ORDER BY lower(label)
      LIMIT 50
    `,
    [query, user.companyId],
  )
  res.json(result)
})

geographyRouter.post('/geography/countries', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'clients')
  if (!user) return
  const name = searchTerm(req.body.name)
  if (name.length < 2) return void res.status(400).json({ error: 'Informe o nome do país.' })
  try {
    const [country] = await AppDataSource.query(
      `INSERT INTO bo.custom_countries (company_id, name)
       VALUES ($1, $2)
       RETURNING 'C:' || id AS value, name AS label, true AS custom`,
      [user.companyId, name],
    )
    res.status(201).json(country)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return void res.status(409).json({ error: 'Este país personalizado já existe.' })
    }
    throw error
  }
})

geographyRouter.get('/geography/states', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'clients')
  if (!user) return
  const country = searchTerm(req.query.country)
  const query = searchTerm(req.query.q)
  const selectedCustomId = customId(country)
  const result = selectedCustomId
    ? await AppDataSource.query(
        `
          SELECT 'C:' || s.id AS value, s.name AS label, true AS custom
          FROM bo.custom_states s
          JOIN bo.custom_countries c ON c.id = s.custom_country_id
          WHERE s.company_id = $1 AND c.company_id = $1 AND c.id = $2
            AND ($3 = '' OR s.name ILIKE '%' || $3 || '%')
          ORDER BY lower(s.name) LIMIT 50
        `,
        [user.companyId, selectedCustomId, query],
      )
    : await AppDataSource.query(
        `
          SELECT value, label, custom
          FROM (
            SELECT COALESCE(NULLIF(s.iso3166_2, ''), s.iso2, s.id::text) AS value,
              s.name AS label, false AS custom
            FROM public.states s
            JOIN public.countries c ON c.id = s.country_id
            WHERE c.iso2 = $1 AND s.flag = 1
              AND ($2 = '' OR s.name ILIKE '%' || $2 || '%' OR s.native ILIKE '%' || $2 || '%')
            UNION ALL
            SELECT 'C:' || s.id, s.name, true
            FROM bo.custom_states s
            JOIN public.countries c ON c.id = s.country_id
            WHERE s.company_id = $3 AND c.iso2 = $1
              AND ($2 = '' OR s.name ILIKE '%' || $2 || '%')
          ) options
          ORDER BY lower(label) LIMIT 50
        `,
        [country.toUpperCase(), query, user.companyId],
      )
  res.json(result)
})

geographyRouter.post('/geography/states', requireAuth, async (req, res) => {
  const user = await requireResourceUser(req, res, 'clients')
  if (!user) return
  const country = searchTerm(req.body.country)
  const name = searchTerm(req.body.name)
  if (!country) return void res.status(400).json({ error: 'Selecione primeiro o país.' })
  if (name.length < 2) return void res.status(400).json({ error: 'Informe o nome do estado.' })
  const selectedCustomId = customId(country)
  try {
    const [state] = selectedCustomId
      ? await AppDataSource.query(
          `
            INSERT INTO bo.custom_states (company_id, custom_country_id, name)
            SELECT $1, id, $3 FROM bo.custom_countries WHERE id = $2 AND company_id = $1
            RETURNING 'C:' || id AS value, name AS label, true AS custom
          `,
          [user.companyId, selectedCustomId, name],
        )
      : await AppDataSource.query(
          `
            INSERT INTO bo.custom_states (company_id, country_id, name)
            SELECT $1, id, $3 FROM public.countries WHERE iso2 = $2
            RETURNING 'C:' || id AS value, name AS label, true AS custom
          `,
          [user.companyId, country.toUpperCase(), name],
        )
    if (!state) return void res.status(404).json({ error: 'País não encontrado.' })
    res.status(201).json(state)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return void res.status(409).json({ error: 'Este estado personalizado já existe.' })
    }
    throw error
  }
})
