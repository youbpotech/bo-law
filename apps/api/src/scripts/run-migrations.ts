import { AppDataSource } from '../data-source'

async function runMigrations(): Promise<void> {
  await AppDataSource.initialize()
  const migrations = await AppDataSource.runMigrations()

  if (migrations.length === 0) {
    console.log('Nenhuma migration pendente.')
  } else {
    console.log(`Migrations executadas: ${migrations.map(({ name }) => name).join(', ')}`)
  }

  await AppDataSource.destroy()
}

runMigrations().catch((error) => {
  console.error('Erro ao executar migrations:', error)
  process.exit(1)
})
