// Leert die Datenbank von "Die Zentrale" komplett – für den echten Einstieg mit eigenen Einträgen.
// Ausführen:  npm run seed
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const [events, tasks, transactions, notes, settings] = await Promise.all([
    db.event.deleteMany(),
    db.task.deleteMany(),
    db.transaction.deleteMany(),
    db.note.deleteMany(),
    db.setting.deleteMany(),
  ])
  console.log(
    `Datenbank geleert: ${events.count} Termine, ${tasks.count} Aufgaben, ${transactions.count} Buchungen, ${notes.count} Notizen, ${settings.count} Einstellungen entfernt.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
