import 'reflect-metadata'
import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
import { AppDataSource } from './data-source'
import routes from './routes'
import { startLeadAudioWorker } from './leads/audio-service'

config()

const app = express()
const PORT = process.env.PORT || 3001

// Middlewares
app.use(cors({ exposedHeaders: ['Content-Disposition'] }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// Rotas
app.use('/api', routes)

// Inicializar conexão com banco de dados
AppDataSource.initialize()
  .then(() => {
    console.log('✅ Conexão com PostgreSQL estabelecida')

    const stopAudioWorker = startLeadAudioWorker()
    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor Express rodando na porta ${PORT}`)
      console.log(`📡 API disponível em http://localhost:${PORT}/api`)
    })

    const shutdown = async () => {
      await stopAudioWorker()
      server.close(async () => {
        await AppDataSource.destroy()
        process.exit(0)
      })
    }

    process.once('SIGTERM', () => void shutdown())
    process.once('SIGINT', () => void shutdown())
  })
  .catch((error) => {
    console.error('❌ Erro ao conectar com o banco de dados:', error)
    process.exit(1)
  })
