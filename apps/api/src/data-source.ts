import 'reflect-metadata'
import { config } from 'dotenv'
import { DataSource } from 'typeorm'
import { Client } from './entities/Client'
import { Company } from './entities/Company'
import { Invoice } from './entities/Invoice'
import { Lead } from './entities/Lead'
import { LeadAudioProcessing } from './entities/LeadAudioProcessing'
import { LeadMessage } from './entities/LeadMessage'
import { LegalCase } from './entities/LegalCase'
import { User } from './entities/User'
import { CreateLegalBackoffice1784678400000 } from './migrations/1784678400000-CreateLegalBackoffice'
import { AddCompanyLogo1784764800000 } from './migrations/1784764800000-AddCompanyLogo'
import { ExpandClientProfile1784851200000 } from './migrations/1784851200000-ExpandClientProfile'

config()

const databaseUrl = process.env.DATABASE_URL
const useSsl =
  process.env.DB_SSL === 'true' ||
  process.env.POSTGRES_SSL === 'true' ||
  databaseUrl?.includes('sslmode=require') ||
  databaseUrl?.includes('render.com') ||
  databaseUrl?.includes('rds.amazonaws.com')

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? {
        url: databaseUrl,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      }
    : {
        host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'),
        username: process.env.POSTGRES_USER || process.env.DB_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'postgres',
        database: process.env.POSTGRES_DB || process.env.DB_NAME || 'bo_law',
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      }),
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Company, Client, Lead, LeadMessage, LeadAudioProcessing, LegalCase, Invoice],
  migrations: [
    CreateLegalBackoffice1784678400000,
    AddCompanyLogo1784764800000,
    ExpandClientProfile1784851200000,
  ],
  subscribers: [],
})
