import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'

const CATEGORIES = ['Wohnen', 'Lebensmittel', 'Abos', 'Mobilität', 'Gesundheit', 'Freizeit', 'Einkommen', 'Sonstiges']
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW']
const TASK_RECURRING = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']
const TX_RECURRING = ['NONE', 'WEEKLY', 'MONTHLY', 'YEARLY']

function systemPrompt(now: Date): string {
  const day = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(now)
  return [
    'Du bist der Erfassungs-Assistent der privaten App "Die Zentrale". Der Nutzer tippt eine kurze deutsche Zeile; du klassifizierst sie und extrahierst die Felder.',
    'Antworte AUSSCHLIESSLICH mit einem einzigen JSON-Objekt. Keine Erklärung, kein Markdown, keine Codeblöcke.',
    `Heute ist ${day}, ${time} Uhr (Zeitzone Europe/Berlin).`,
    '',
    'Wähle GENAU EINEN der vier Typen:',
    `1. Termin: {"kind":"event","title":"...","date":"YYYY-MM-DD","time":"HH:MM" oder null,"place":"..." oder null,"priority":"HIGH|MEDIUM|LOW","yearly":true|false}`,
    `2. Aufgabe: {"kind":"task","title":"...","dueDate":"YYYY-MM-DD" oder null,"priority":"HIGH|MEDIUM|LOW","recurring":"NONE|DAILY|WEEKLY|MONTHLY|YEARLY"}`,
    `3. Buchung: {"kind":"transaction","title":"...","amount":Zahl>0,"type":"INCOME|EXPENSE","category":"...","date":"YYYY-MM-DD","recurring":"NONE|WEEKLY|MONTHLY|YEARLY"}`,
    '4. Notiz: {"kind":"note","title":"...","content":"..."}',
    '',
    'Regeln:',
    '- Relative Zeitangaben ("heute", "morgen", "übermorgen", "am Samstag", "nächste Woche Freitag", "in 3 Tagen", "12.3.") in ein absolutes Datum YYYY-MM-DD umrechnen. Nie Vergangenheit wählen, außer das Jahr wurde explizit genannt.',
    '- Uhrzeit wie "14:30", "14 Uhr", "18h", "halbsieben" -> "HH:MM". Keine Zeit erkennbar -> null (ganztägig).',
    '- Geburtstage/Jahrestage ("X. Geburtstag von Anna", "Jahrestag") -> kind=event mit yearly=true, Datum als nächstes kommendes Jahresdatum.',
    '- Geldbeträge: "Zahnarzt 45" oder "45 Euro gekauft" -> transaction mit EXPENSE. "Gehalt", "Erstattung", "bekomme 500" -> INCOME.',
    `- category NUR aus dieser Liste: ${CATEGORIES.join(', ')}. Miete->Wohnen, Supermarkt/Einkauf->Lebensmittel, Netflix/Spotify/Abo->Abos, Tanken/BVG/Parken->Mobilität, Apotheke/Arzt->Gesundheit, Kino/Sport/Hobby/Restaurant->Freizeit, Gehalt->Einkommen, sonst Sonstiges.`,
    '- "jeden Monat", "monatlich", "jede Woche" bei Buchungen -> recurring setzen; Miete/Abos mit erkennbarer Periodizität -> MONTHLY, sonst NONE.',
    '- Wichtigkeit: "wichtig", "dringend", "muss", "ASAP" -> HIGH; "irgendwann", "optional", "wenn Zeit" -> LOW; sonst MEDIUM.',
    '- title: kurz und klar, max. 60 Zeichen, ohne Betrag/Uhrzeit. Bei Notiz: title = 3-6 Wörter, content = vollständiger Text.',
    '- Nicht erkannte Felder auf null/false/NONE setzen statt Inhalte erfinden. amount nur als Zahl (Punkt als Dezimaltrenner).',
  ].join('\n')
}

/** Erstes JSON-Objekt aus der Antwort ziehen (fängt Codeblöcke und Resttext ab). */
function extractJson(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function validIsoDate(s: unknown): string | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? s : null
}

function validTime(s: unknown): string | null {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null
}

function cleanText(s: unknown, max = 120): string | null {
  if (typeof s !== 'string') return null
  const t = s.replace(/\s+/g, ' ').trim().slice(0, max)
  return t || null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T => (list.includes(v as T) ? (v as T) : list[list.length - 1])
const bool = (v: unknown): boolean => v === true

export type ParsedEntry =
  | { kind: 'event'; title: string; date: string; time: string | null; place: string | null; priority: string; yearly: boolean }
  | { kind: 'task'; title: string; dueDate: string | null; priority: string; recurring: string }
  | { kind: 'transaction'; title: string; amount: number; type: string; category: string; date: string; recurring: string }
  | { kind: 'note'; title: string; content: string }

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { text?: unknown } | null
    const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
    if (!text) return NextResponse.json({ error: 'Kein Text übergeben.' }, { status: 400 })

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt(new Date()) },
        { role: 'user', content: text },
      ],
      thinking: { type: 'disabled' },
    })
    const raw = completion.choices[0]?.message?.content ?? ''
    const json = extractJson(raw)
    if (!json) return NextResponse.json({ error: 'Antwort konnte nicht gelesen werden.' }, { status: 422 })

    const fallbackTitle = text.slice(0, 60)
    const kind = json.kind

    if (kind === 'event') {
      const entry: ParsedEntry = {
        kind: 'event',
        title: cleanText(json.title, 60) ?? fallbackTitle,
        date: validIsoDate(json.date) ?? new Date().toISOString().slice(0, 10),
        time: validTime(json.time),
        place: cleanText(json.place),
        priority: oneOf(json.priority, PRIORITIES),
        yearly: bool(json.yearly),
      }
      return NextResponse.json(entry)
    }
    if (kind === 'task') {
      const entry: ParsedEntry = {
        kind: 'task',
        title: cleanText(json.title, 60) ?? fallbackTitle,
        dueDate: validIsoDate(json.dueDate),
        priority: oneOf(json.priority, PRIORITIES),
        recurring: oneOf(json.recurring, TASK_RECURRING),
      }
      return NextResponse.json(entry)
    }
    if (kind === 'transaction') {
      const amount = num(json.amount)
      const entry: ParsedEntry = {
        kind: 'transaction',
        title: cleanText(json.title, 60) ?? fallbackTitle,
        amount: amount && amount > 0 ? Math.round(amount * 100) / 100 : 0,
        type: json.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
        category: CATEGORIES.includes(json.category as string) ? (json.category as string) : 'Sonstiges',
        date: validIsoDate(json.date) ?? new Date().toISOString().slice(0, 10),
        recurring: oneOf(json.recurring, TX_RECURRING),
      }
      if (entry.amount <= 0) return NextResponse.json({ error: 'Kein Betrag erkannt.' }, { status: 422 })
      return NextResponse.json(entry)
    }
    if (kind === 'note') {
      const entry: ParsedEntry = {
        kind: 'note',
        title: cleanText(json.title, 60) ?? fallbackTitle,
        content: cleanText(json.content, 4000) ?? '',
      }
      return NextResponse.json(entry)
    }
    return NextResponse.json({ error: 'Typ nicht erkannt.' }, { status: 422 })
  } catch (err) {
    console.error('[parse] Fehler:', err)
    return NextResponse.json({ error: 'Assistent momentan nicht erreichbar.' }, { status: 502 })
  }
}
