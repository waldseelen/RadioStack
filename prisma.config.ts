import { defineConfig } from '@prisma/config'

export default defineConfig({
  seed: 'ts-node prisma/seed.ts',
})
