import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as fs from 'fs'
import * as path from 'path'

const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8')
const envVars = Object.fromEntries(
  envFile.split('\n').filter(Boolean).map((line) => line.split('=', 2))
)

const adapter = new PrismaPg({ connectionString: envVars['DATABASE_URL'] })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Creating practice...')
  const practice = await prisma.practice.upsert({
    where: { code: 'ARWM' },
    update: {},
    create: {
      name: 'Andrew Rowan Wealth Management',
      code: 'ARWM',
      status: 'active',
    },
  })

  console.log('Creating user: Andrew Rowan...')
  await prisma.user_account.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      practice_id: practice.id,
      name: 'Andrew Rowan',
      email: 'andrew@arwm.com.au',
      role: 'owner',
      status: 'active',
    },
  })

  console.log('Done')
  await prisma.$disconnect()
}

main().catch(console.error)
