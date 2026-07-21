import { Router } from 'express'
import { AppDataSource } from '../data-source'
import {
  Company,
  DashboardConfig,
  DashboardWidgetKey,
  DEFAULT_DASHBOARD_WIDGETS,
} from '../entities/Company'
import { requireAuth } from '../auth/middleware'
import { requireCurrentUser } from '../auth/current-user'

export const dashboardRouter = Router()

export const DASHBOARD_WIDGETS: DashboardWidgetKey[] = [
  ...DEFAULT_DASHBOARD_WIDGETS,
  'receivedAmount',
  'rehydrationsDue',
]

export function normalizeDashboardConfig(value: unknown): DashboardConfig {
  const candidate =
    value && typeof value === 'object' && 'widgets' in value
      ? (value as { widgets?: unknown }).widgets
      : value
  const widgets = Array.isArray(candidate)
    ? Array.from(
        new Set(
          candidate.filter(
            (widget): widget is DashboardWidgetKey =>
              typeof widget === 'string' &&
              DASHBOARD_WIDGETS.includes(widget as DashboardWidgetKey),
          ),
        ),
      )
    : []

  return { widgets: widgets.length ? widgets : [...DEFAULT_DASHBOARD_WIDGETS] }
}

dashboardRouter.get('/dashboard', requireAuth, async (req, res) => {
  const user = await requireCurrentUser(req, res)
  if (!user) return

  res.json(normalizeDashboardConfig(user.company.dashboardConfig))
})

dashboardRouter.put('/dashboard', requireAuth, async (req, res) => {
  const user = await requireCurrentUser(req, res)
  if (!user) return

  const requestedWidgets = req.body?.widgets
  if (!Array.isArray(requestedWidgets) || requestedWidgets.length === 0) {
    res.status(400).json({ error: 'Selecione ao menos um indicador para o dashboard' })
    return
  }

  const config = normalizeDashboardConfig({ widgets: requestedWidgets })
  user.company.dashboardConfig = config
  await AppDataSource.getRepository(Company).save(user.company)
  res.json(config)
})

dashboardRouter.get('/dashboard/stats', requireAuth, async (req, res) => {
  const user = await requireCurrentUser(req, res)
  if (!user) return

  const [
    leadRows,
    caseRows,
    billingRows,
    leadPipelineRows,
    casePipelineRows,
    recentLeads,
    recentCases,
  ] = await Promise.all([
    AppDataSource.query(
      `SELECT
          count(*)::int AS "totalLeads",
          count(*) FILTER (WHERE "qualification_level" = 'quente')::int AS "hotLeads",
          count(*) FILTER (WHERE "sales_stage" = 'interview_scheduled')::int AS "pendingInterviews",
          count(*) FILTER (WHERE "sales_stage" = 'nurturing' AND "rehydrate_at" <= now())::int AS "rehydrationsDue"
        FROM "bo"."leads" WHERE "company_id" = $1`,
      [user.companyId],
    ),
    AppDataSource.query(
      `SELECT
          count(*) FILTER (WHERE "stage" <> 'closed')::int AS "activeCases",
          count(*) FILTER (WHERE "stage" IN ('document_collection', 'awaiting_documents'))::int AS "pendingDocuments"
        FROM "bo"."legal_cases" WHERE "company_id" = $1`,
      [user.companyId],
    ),
    AppDataSource.query(
      `SELECT
          COALESCE(sum(i."amount") FILTER (WHERE i."status" <> 'paid'), 0)::text AS "outstandingAmount",
          COALESCE(sum(i."amount") FILTER (WHERE i."status" = 'paid'), 0)::text AS "receivedAmount"
        FROM "bo"."invoices" i
        INNER JOIN "bo"."legal_cases" c ON c."id" = i."legal_case_id"
        WHERE c."company_id" = $1`,
      [user.companyId],
    ),
    AppDataSource.query(
      `SELECT "sales_stage" AS "key", count(*)::int AS "count"
         FROM "bo"."leads" WHERE "company_id" = $1 GROUP BY "sales_stage"`,
      [user.companyId],
    ),
    AppDataSource.query(
      `SELECT "stage" AS "key", count(*)::int AS "count"
         FROM "bo"."legal_cases" WHERE "company_id" = $1 GROUP BY "stage"`,
      [user.companyId],
    ),
    AppDataSource.query(
      `SELECT "id", "name", "phone", "sales_stage" AS "salesStage", "qualification_level" AS "qualificationLevel", "created_at" AS "createdAt"
         FROM "bo"."leads" WHERE "company_id" = $1 ORDER BY "created_at" DESC LIMIT 5`,
      [user.companyId],
    ),
    AppDataSource.query(
      `SELECT c."id", c."title", c."stage", c."updated_at" AS "updatedAt", cl."name" AS "clientName"
         FROM "bo"."legal_cases" c INNER JOIN "bo"."clients" cl ON cl."id" = c."client_id"
         WHERE c."company_id" = $1 ORDER BY c."updated_at" DESC LIMIT 5`,
      [user.companyId],
    ),
  ])

  const toRecord = (rows: Array<{ key: string; count: number }>) =>
    Object.fromEntries(rows.map((row) => [row.key, Number(row.count)]))

  res.json({
    ...leadRows[0],
    ...caseRows[0],
    ...billingRows[0],
    leadPipeline: toRecord(leadPipelineRows),
    casePipeline: toRecord(casePipelineRows),
    recentLeads,
    recentCases,
  })
})
