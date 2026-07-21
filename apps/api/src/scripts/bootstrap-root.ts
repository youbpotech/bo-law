import { AppDataSource } from '../data-source'
import { hashPassword } from '../auth/password'
import { Company } from '../entities/Company'
import { User } from '../entities/User'

function requiredText(value: string | undefined) {
  return value?.trim() ?? ''
}

async function bootstrapRoot(): Promise<void> {
  await AppDataSource.initialize()

  try {
    const userRepository = AppDataSource.getRepository(User)
    if (await userRepository.existsBy({ root: true })) {
      console.log('Bootstrap root ignorado: já existe um usuário root.')
      return
    }

    const name = requiredText(process.env.BOOTSTRAP_ROOT_NAME)
    const username = requiredText(process.env.BOOTSTRAP_ROOT_USERNAME).toLowerCase()
    const password = process.env.BOOTSTRAP_ROOT_PASSWORD ?? ''
    const companyId = Number(process.env.BOOTSTRAP_ROOT_COMPANY_ID ?? 1)

    if (!name || !username || password.length < 12) {
      throw new Error(
        'Nenhum usuário root existe. Configure BOOTSTRAP_ROOT_NAME, BOOTSTRAP_ROOT_USERNAME e BOOTSTRAP_ROOT_PASSWORD com ao menos 12 caracteres.',
      )
    }
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error('BOOTSTRAP_ROOT_COMPANY_ID inválido.')
    }
    if (!(await AppDataSource.getRepository(Company).existsBy({ id: companyId }))) {
      throw new Error('A empresa informada em BOOTSTRAP_ROOT_COMPANY_ID não existe.')
    }

    const duplicate = await userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) = LOWER(:username)', { username })
      .getOne()
    if (duplicate) throw new Error('BOOTSTRAP_ROOT_USERNAME já pertence a outro usuário.')

    await userRepository.save(
      userRepository.create({
        name,
        username,
        password: await hashPassword(password),
        companyId,
        root: true,
        email: null,
      }),
    )
    console.log(`Usuário root criado para a empresa ${companyId}.`)
  } finally {
    await AppDataSource.destroy()
  }
}

bootstrapRoot().catch((error) => {
  console.error('Erro ao preparar usuário root:', error)
  process.exit(1)
})
