import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { ensureMinimumDatabaseSchema } from '@/db/ensureSchema'

await ensureMinimumDatabaseSchema()

const fetch = createStartHandler(defaultStreamHandler)

export default { fetch }
