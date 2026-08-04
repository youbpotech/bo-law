import { AppDataSource } from '../data-source'
import { Company } from '../entities/Company'
import { User } from '../entities/User'
import { saveNotificationChannelPreferences } from '../notifications/preferences'
import { UserNotificationChannel } from '../entities/UserNotificationChannel'
import {
  assignPlatformRoot,
  createKeycloakUser,
  ensureCompanyRootRole,
  setUserRoles,
  updateKeycloakUser,
} from '../keycloak-admin'

function requiredText(value: string | undefined) {
  return value?.trim() ?? ''
}

async function bootstrapRoot(): Promise<void> {
  await AppDataSource.initialize()
  try {
    const userRepository = AppDataSource.getRepository(User)
    let user = await userRepository.findOneBy({ root: true })
    const name = requiredText(process.env.BOOTSTRAP_ROOT_NAME)
    const username = requiredText(process.env.BOOTSTRAP_ROOT_USERNAME).toLowerCase()
    const password = process.env.BOOTSTRAP_ROOT_PASSWORD ?? ''
    const companyId = Number(process.env.BOOTSTRAP_ROOT_COMPANY_ID ?? 1)

    if (!user?.keycloakId && (!name || !username || password.length < 12)) {
      throw new Error(
        'Configure BOOTSTRAP_ROOT_NAME, BOOTSTRAP_ROOT_USERNAME e BOOTSTRAP_ROOT_PASSWORD com ao menos 12 caracteres para sincronizar o administrador com o Keycloak.',
      )
    }
    if (!Number.isInteger(companyId) || companyId <= 0) throw new Error('BOOTSTRAP_ROOT_COMPANY_ID inválido.')
    if (!(await AppDataSource.getRepository(Company).existsBy({ id: companyId }))) throw new Error('A empresa informada não existe.')

    const companies = await AppDataSource.getRepository(Company).find()
    const companyRootRoles = new Map<number, Awaited<ReturnType<typeof ensureCompanyRootRole>>>()
    for (const company of companies) {
      companyRootRoles.set(company.id, await ensureCompanyRootRole(company.id))
    }
    const rootRole = companyRootRoles.get(companyId)
    if (!rootRole) throw new Error('Role Root da empresa inicial não encontrada')
    if (!user) {
      user = userRepository.create({ name, username, email: null, phone: null, password: null, companyId, root: true, keycloakId: null })
    }
    if (!user.keycloakId) {
      user.keycloakId = await createKeycloakUser({ companyId, name, username, email: user.email, password, roleIds: [rootRole.id] })
    } else {
      await setUserRoles(user.keycloakId, companyId, [rootRole.id])
    }
    await updateKeycloakUser(user.keycloakId, {
      companyId,
      name: user.name,
      username: user.username,
      email: user.email,
      password,
      roleIds: [rootRole.id],
    })
    await assignPlatformRoot(user.keycloakId)
    user.password = null
    await AppDataSource.transaction(async (manager) => {
      const saved = await manager.getRepository(User).save(user)
      if (
        !(await manager.getRepository(UserNotificationChannel).existsBy({ userId: saved.id }))
      ) {
        await saveNotificationChannelPreferences(manager, saved.id, ['internal'])
      }
    })
    console.log(`Administrador sincronizado com o Keycloak para a empresa ${companyId}.`)
  } finally {
    await AppDataSource.destroy()
  }
}

bootstrapRoot().catch((error) => {
  console.error('Erro ao preparar administrador Keycloak:', error)
  process.exit(1)
})
