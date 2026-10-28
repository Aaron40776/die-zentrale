// Leert die Datenbank von "Die Zentrale" komplett – für den echten Einstieg mit eigenen Einträgen.
// Ausführen:  bun prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const [events, tasks, transactions, notes] = await Promise.all([
    db.event.deleteMany(),
    db.task.deleteMany(),
    db.transaction.deleteMany(),
    db.note.deleteMany(),
  ])
  console.log(
    `Datenbank geleert: ${events.count} Termine, ${tasks.count} Aufgaben, ${transactions.count} Buchungen, ${notes.count} Notizen entfernt.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
