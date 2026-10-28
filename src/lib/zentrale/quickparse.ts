// Lokale Schnelleingabe: versteht kurze deutsche Zeilen ohne KI-Backend.
// Wird vom Server als Fallback genutzt, wenn der KI-Dienst nicht erreichbar ist.
import { addMonthsClamped, dayKey, startOfDay } from './date'
import { CATEGORIES, type ParsedEntry, type Priority, type Recurring, type TxType } from './types'

const MONTHS: Record<string, number> = {
  januar: 0, jan: 0, februar: 1, feb: 1, märz: 2, maerz: 2, mar: 2, april: 3, apr: 3,
  mai: 4, juni: 5, jun: 5, juli: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8,
  oktober: 9, okt: 9, november: 10, nov: 10, dezember: 11, dez: 11,
}

const WEEKDAYS: Record<string, number> = {
  sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6,
}

const TASK_WORDS = /(?<!\S)(kaufen|einkaufen|erledigen|zahlen|bezahlen|anrufen|telefonieren|schicken|senden|aufräumen|putzen|waschen|besorgen|buchen|kündigen|abholen|prüfen|recherchieren|antworten|mailen|schreiben|planen|organisieren|reparieren|bewerben|beantragen|verlängern|einreichen|vorbereiten|zurückschicken|umtauschen|gießen|füttern|staubsaugen|müll|sortieren|ordnen|ablegen|archivieren|durchsehen|sammeln|überlegen|brainstormen|notieren|machen|vereinbaren|absagen|verschieben|packen|einpacken|auspacken|abgeben|einzahlen|überweisen|lernen|üben|trainieren|lesen|joggen|laufen)\b/i

const EVENT_WORDS = /(?<!\S)(termin|treffen|meeting|geburtstag|jahrestag|feier|party|konzert|kino|restaurant|arzt|ärztin|zahnarzt|friseur|interview|workshop|vorlesung|stammtisch|spiel|elternabend|hochzeit|beerdigung|begräbnis|flug|zugfahrt|reise|urlaub|theater|ausstellung)\b/i

const INCOME_WORDS = /(?<!\S)(gehalt|lohn|(?:rück)?erstattung|rückzahlung|gutschrift|einnahme|verkauft|verkauf|bekomme|bekommen|bonus|zinsen|dividende|honorar|erhalten)\b/i

const CATEGORY_RULES: [RegExp, string][] = [
  [/miete|wohnung|nebenkosten|strom|gas|heizung|internet|wlan|haushalt|möbel|stadtwerke|rechnung\b/i, 'Wohnen'],
  [/supermarkt|einkauf|lebensmittel|rewe|edeka|aldi|lidl|kaufland|bäck|metzg|obst|gemüse|milch|brot|kaffee|drogerie|dm\b|rossmann/i, 'Lebensmittel'],
  [/netflix|spotify|disney|abo\b|abonnement|versicherung|handyvertrag|cloud|youtube|apple|prime|zeitschrift/i, 'Abos'],
  [/tanken|tankstelle|benzin|diesel|bvg|bahn|zug\b|ticket|parken|auto|fahrrad|taxi|uber|öpnv|bus\b|reparatur/i, 'Mobilität'],
  [/arzt|ärztin|apotheke|zahnarzt|medikament|krankenhaus|therapie|physio|gesundheit|brille/i, 'Gesundheit'],
  [/kino|restaurant|essen gehen|fitness|sport|verein|konzert|freizeit|hobby|urlaub|hotel|bar\b|café|cafe|bistro|museum/i, 'Freizeit'],
  [/gehalt|lohn|erstattung|rückzahlung|gutschrift|einnahme|verkauft|bonus|zinsen|dividende|honorar/i, 'Einkommen'],
]

const HOUR_WORDS: Record<string, number> = {
  eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
}

function stripTime(text: string): { time: string | null; rest: string } {
  const patterns: { re: RegExp; hm: (m: RegExpMatchArray) => string }[] = [
    {
      // "halb sieben" = 6:30, "viertel nach sieben" = 7:15, "viertel vor sieben" = 6:45
      re: /\b(?:um\s+)?(halb|viertel\s+nach|viertel\s+vor|dreiviertel)\s+(eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\b/i,
      hm: (m) => {
        const h = HOUR_WORDS[m[2].toLowerCase()]
        const kind = m[1].toLowerCase().replace(/\s+/g, ' ')
        let hour = h
        let minute = 0
        if (kind === 'halb') { hour = h - 1 || 12; minute = 30 }
        else if (kind === 'viertel nach') { minute = 15 }
        else { hour = h - 1 || 12; minute = 45 }
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      },
    },
    { re: /\b(?:um\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i, hm: (m) => `${String(Number(m[1])).padStart(2, '0')}:${m[2]}` },
    { re: /\b(?:um\s+)?([01]?\d|2[0-3])(?:[.,]([0-5]\d))?\s*(?:uhr|h)\b/i, hm: (m) => `${String(Number(m[1])).padStart(2, '0')}:${m[2] ?? '00'}` },
    { re: /\bum\s+([01]?\d|2[0-3])\b/i, hm: (m) => `${String(Number(m[1])).padStart(2, '0')}:00` },
  ]
  for (const p of patterns) {
    const m = text.match(p.re)
    if (m) return { time: p.hm(m), rest: text.replace(m[0], ' ') }
  }
  return { time: null, rest: text }
}

function buildDate(y: number, mo: number, d: number): Date | null {
  const dt = new Date(y, mo, d)
  return Number.isNaN(dt.getTime()) || dt.getMonth() !== mo || dt.getDate() !== d ? null : dt
}

function stripDate(text: string, now: Date): { date: Date | null; rest: string } {
  const today = startOfDay(now)
  const lower = text.toLowerCase()

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)
  if (iso) {
    const d = buildDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    if (d) return { date: d, rest: text.replace(iso[0], ' ') }
  }

  // Umlaute sind für \b keine Wortzeichen: "übermorgen" braucht explizite Ränder.
  const relative = text.match(/(?:^|\s)(heute|morgen|übermorgen|vorgestern|gestern)(?=[\s,.;!?]|$)/i)
  if (relative) {
    const word = relative[1].toLowerCase()
    const offsets: Record<string, number> = { heute: 0, morgen: 1, übermorgen: 2, gestern: -1, vorgestern: -2 }
    const d = new Date(today)
    d.setDate(d.getDate() + offsets[word])
    return { date: d, rest: text.replace(relative[0], ' ') }
  }

  const inDays = text.match(/\bin\s+(\d{1,2})\s+(tag|tagen|woche|wochen|monat|monaten)\b/i)
  if (inDays) {
    const n = Number(inDays[1])
    const unit = inDays[2].toLowerCase()
    const d = new Date(today)
    if (unit.startsWith('tag')) d.setDate(d.getDate() + n)
    else if (unit.startsWith('woche')) d.setDate(d.getDate() + n * 7)
    else return { date: addMonthsClamped(today, n), rest: text.replace(inDays[0], ' ') }
    return { date: d, rest: text.replace(inDays[0], ' ') }
  }

  // "am 12.11." / "12.11.2026"
  const numeric = text.match(/\b(?:am\s+)?(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\.?(?!\d)/i)
  if (numeric) {
    const dayN = Number(numeric[1])
    const monthN = Number(numeric[2]) - 1
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear()
    if (year < 100) year += 2000
    let d = buildDate(year, monthN, dayN)
    if (d && !numeric[3] && d < today) d = buildDate(year + 1, monthN, dayN)
    if (d) return { date: d, rest: text.replace(numeric[0], ' ') }
  }

  // "12. November" / "am 12. November"
  const monthName = text.match(/\b(?:am\s+)?(\d{1,2})\.?\s*(januar|jan|februar|feb|märz|maerz|mar|april|apr|mai|juni|jun|juli|jul|august|aug|september|sept?|oktober|okt|november|nov|dezember|dez)\b/i)
  if (monthName) {
    const dayN = Number(monthName[1])
    const mo = MONTHS[monthName[2].toLowerCase()]
    let d = buildDate(now.getFullYear(), mo, dayN)
    if (d && d < today) d = buildDate(now.getFullYear() + 1, mo, dayN)
    if (d) return { date: d, rest: text.replace(monthName[0], ' ') }
  }

  // "am Montag" / "nächsten Freitag"
  const weekday = text.match(/(?:^|\s)(?:(am|jeden|übernächsten?|nächsten?|diesen?)\s+)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag)\b/i)
  if (weekday) {
    const target = WEEKDAYS[weekday[2].toLowerCase()]
    const d = new Date(today)
    const delta = (target - d.getDay() + 7) % 7
    d.setDate(d.getDate() + delta)
    // "nächsten Freitag" am Freitag meint die kommende Woche, nicht heute.
    if (/^nächsten?$/i.test(weekday[1] ?? '') && delta === 0) d.setDate(d.getDate() + 7)
    if (/^übernächsten?$/i.test(weekday[1] ?? '')) d.setDate(d.getDate() + 7)
    if (/nächste[rn]? woche/i.test(lower)) d.setDate(d.getDate() + 7)
    return { date: d, rest: text.replace(weekday[0], ' ').replace(/\bnächste[rn]? woche\b/i, ' ') }
  }

  // "übernächste Woche" ohne Wochentag -> Montag in zwei Wochen
  if (/(?:^|\s)übernächste[rn]? woche\b/i.test(lower)) {
    const d = new Date(today)
    const delta = (1 - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + delta + 7)
    return { date: d, rest: text.replace(/(?:^|\s)übernächste[rn]? woche\b/i, ' ') }
  }

  // "nächste Woche" ohne Wochentag -> Montag der Folgewoche
  if (/\bnächste[rn]? woche\b/i.test(lower)) {
    const d = new Date(today)
    const delta = (1 - d.getDay() + 7) % 7 || 7
    d.setDate(d.getDate() + delta)
    return { date: d, rest: text.replace(/\bnächste[rn]? woche\b/i, ' ') }
  }

  return { date: null, rest: text }
}

const MONEY_CONTEXT = /(?<!\S)(miete|abo|abonnement|rechnung|gehalt|lohn|einkauf|einkaufen|kaffee|essen|mittagessen|abendessen|frühstück|tanken|getankt|benzin|diesel|versicherung|strom|gas|internet|handy|netflix|spotify|preis|kosten|bezahlt|kostet|ausgabe|einnahme|überweis\w*|brot|milch|käse|obst|gemüse|fleisch|wurst|eier|mehl|zucker|tee|wasser|saft|bier|wein|snack|süßigkeiten|drogerie|baumarkt|geschenk|blumen|kleidung|schuhe|fitness|yoga|friseur|apotheke|reparatur|lieferando|döner|pizza|imbiss|bäckerei|metzgerei|parken|kita|kindergarten|schule|verein|mitgliedschaft|spende)\b/i
const PAYEE_HINTS = /(?<!\S)(bvg|bahn|ticket|tankstelle|supermarkt|rewe|edeka|aldi|lidl|dm|rossmann|apotheke|friseur|restaurant|café|cafe|bistro|stadtwerke)\b/i

/** "1.234,56" / "1.234" / "12,99" deutsch lesen – ohne aus 1.234 fälschlich 1,234 zu machen. */
function parseGermanAmount(raw: string): number {
  const clean = raw.replace(/\s/g, '')
  if (clean.includes(',')) return Number(clean.replace(/\./g, '').replace(',', '.'))
  if (/^\d{1,3}(?:\.\d{3})+$/.test(clean)) return Number(clean.replace(/\./g, ''))
  return Number(clean)
}

function stripAmount(text: string): { amount: number | null; rest: string } {
  const patterns = [
    /€\s*(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/,
    /(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(?:€|eur\b|euro\b)/i,
    /\b(?:kostet|kosten|bezahlt|ausgegeben)\s+(\d+(?:[.,]\d{1,2})?)\b/i,
    /\bfür\s+(\d+[.,]\d{1,2})\b/i,
    // Nackte Komma-Beträge ("Netflix 12,99") sind im Deutschen eindeutig Geld.
    /(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2})(?=[\s,.;!?]|$)/,
  ]
  // "Miete 800" / "Zahnarzt 45": ganze Zahl am Ende ist ein Betrag, wenn ein
  // Geld- oder konkreter Terminbegriff davorsteht. "Yoga 60" (Minuten) bleibt Aufgabe.
  const bareContext =
    MONEY_CONTEXT.test(text) ||
    PAYEE_HINTS.test(text) ||
    INCOME_WORDS.test(text) ||
    (EVENT_WORDS.test(text) && !/\b(termin|treffen|meeting)\b/i.test(text))
  if (bareContext) {
    const bare = text.match(/(?:^|\s)((?!20\d{2}\b)(?:\d{1,3}(?:\.\d{3})+|\d{1,4}))(?:\s*(?:€|eur|euro))?(?=\s*(?:am\s+\d{1,2}\.?\s*)?(?:monatlich|jährlich|wöchentlich|täglich|pro\s+(?:monat|jahr|woche|tag)|im\s+(?:monat|jahr)|jeden\s+(?:monat|tag|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))?\s*$)/i)
    if (bare) {
      const value = parseGermanAmount(bare[1])
      if (Number.isFinite(value) && value > 0) return { amount: value, rest: text.replace(bare[0], ' ') }
    }
  }
  for (const re of patterns) {
    const m = text.match(re)
    if (!m) continue
    const value = parseGermanAmount(m[1])
    if (Number.isFinite(value) && value > 0) return { amount: Math.round(value * 100) / 100, rest: text.replace(m[0], ' ') }
  }
  return { amount: null, rest: text }
}

function detectPriority(lower: string): Priority {
  if (/\b(wichtig|dringend|asap|eilt|sofort|muss|unbedingt)\b/i.test(lower)) return 'HIGH'
  if (/\b(irgendwann|optional|vielleicht|wenn zeit|später|unwichtig|eventuell)\b/i.test(lower)) return 'LOW'
  return 'MEDIUM'
}

function detectRecurring(lower: string, kind: 'task' | 'transaction' | 'event'): Recurring {
  if (kind === 'task') {
    if (/\b(täglich|jeden tag|jede nacht)\b/i.test(lower)) return 'DAILY'
    if (/\b(wöchentlich|jede woche|jeden (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))\b/i.test(lower)) return 'WEEKLY'
    if (/\b(monatlich|jeden monat|jedes monat|am (1|ersten)\.?)\b/i.test(lower)) return 'MONTHLY'
    if (/\b(jährlich|jedes jahr|jeden jahrestag)\b/i.test(lower)) return 'YEARLY'
    return 'NONE'
  }
  if (/\b(jede woche|jeden (montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|wöchentlich|pro woche|weekly)\b/i.test(lower)) return 'WEEKLY'
  if (/\b(jeden monat|jedes monat|monatlich|pro monat|monatlich)\b|\bam\s+(?:1|ersten)\.?(?=\s|$)/i.test(lower)) return 'MONTHLY'
  if (/\b(jedes jahr|jährlich|pro jahr|jährlich)\b/i.test(lower)) return 'YEARLY'
  return 'NONE'
}

function detectCategory(lower: string): string {
  for (const [re, cat] of CATEGORY_RULES) if (re.test(lower)) return cat
  return 'Sonstiges'
}

function cleanTitle(rest: string, fallback: string): string {
  const cleaned = rest
    .replace(/(?:^|\s)(bitte|mal|noch|schnell|gleich|heute|morgen|übermorgen|gestern|vorgestern)(?=[\s,.;!?]|$)/gi, ' ')
    // Dauer ist keine Aufgabe: "für 2 Stunden lernen" -> "lernen"
    .replace(/\b(?:für\s+)?\d+\s*(?:min(?:uten)?|std\.?|stunden?|tage?n?|wochen?)\b/gi, ' ')
    .replace(/\b(wichtig|dringend|asap|eilt|sofort|unbedingt|irgendwann|optional|vielleicht|unwichtig|eventuell)\b/gi, ' ')
    .replace(/\b(jeden tag|täglich|jede woche|wöchentlich|jeden monat|monatlich|jedes jahr|jährlich)\b/gi, ' ')
    .replace(/\b(jeden\s+(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag))\b/gi, ' ')
    .replace(/\b(?:€|eur|euro)\b/gi, ' ')
    .replace(/\bam\s+\d{1,2}\.?(?=\s|$)/gi, ' ')
    .replace(/\b(bis|am|um|für|den|der|die|das|einen|eine|einer)\s*$/gi, ' ')
    .replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, '')
    // Nach dem Entfernen von Schlusszeichen kann erneut ein Füllwort am Ende stehen.
    .replace(/\b(bis|am|um|für|den|der|die|das|einen|eine|einer)\s*$/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const title = cleaned.length >= 2 ? cleaned : fallback.trim()
  return title.charAt(0).toUpperCase() + title.slice(1)
}

/**
 * Wandelt eine freie deutsche Zeile in einen strukturierten Eintrag um.
 * Gibt null zurück, wenn kein sinnvoller Titel übrig bleibt.
 */
export function parseQuickText(input: string, now: Date = new Date()): ParsedEntry | null {
  const text = input.replace(/\s+/g, ' ').trim()
  if (!text) return null
  const lower = text.toLowerCase()

  // Explizite Präfixe haben Vorrang
  const notePrefix = /^(?:notiz|note|merken|gedanke)\s*[:\-]\s*/i.exec(text)
  if (notePrefix) {
    const body = text.slice(notePrefix[0].length).trim()
    if (!body) return null
    const words = body.split(' ').slice(0, 5).join(' ')
    return { kind: 'note', title: words.slice(0, 60), content: body.slice(0, 4000) }
  }

  const forced = /^(termin|aufgabe|todo|ausgabe|einnahme)\s*[:\-]\s*/i.exec(text)
  const body = forced ? text.slice(forced[0].length).trim() : text
  const bodyLower = body.toLowerCase()

  const timeHit = stripTime(body)
  const dateHit = stripDate(timeHit.rest, now)
  const amountHit = stripAmount(dateHit.rest)
  const date = dateHit.date
  const time = timeHit.time
  const amount = amountHit.amount
  const priority = detectPriority(bodyLower)
  const forcedKind = forced ? forced[1].toLowerCase() : null

  const forcedNonMoney = forcedKind === 'termin' || forcedKind === 'aufgabe' || forcedKind === 'todo'

  // ---------- Buchung ----------
  if (!forcedNonMoney && (amount !== null || forcedKind === 'ausgabe' || forcedKind === 'einnahme')) {
    if (amount === null) return null
    const type: TxType =
      forcedKind === 'einnahme' || (forcedKind !== 'ausgabe' && INCOME_WORDS.test(bodyLower)) ? 'INCOME' : 'EXPENSE'
    const category = type === 'INCOME' ? 'Einkommen' : detectCategory(bodyLower)
    return {
      kind: 'transaction',
      title: cleanTitle(amountHit.rest, type === 'INCOME' ? 'Einnahme' : 'Ausgabe'),
      amount,
      type,
      category: (CATEGORIES as readonly string[]).includes(category) ? category : 'Sonstiges',
      date: dayKey(date ?? now),
      recurring: detectRecurring(bodyLower, 'transaction'),
    }
  }

  const wantsTask = forcedKind === 'aufgabe' || forcedKind === 'todo' || TASK_WORDS.test(bodyLower)
  const wantsEvent = forcedKind === 'termin' || EVENT_WORDS.test(bodyLower)

  // ---------- Aufgabe ----------
  // Ein Aufgaben-Verb ("anrufen", "kaufen") gewinnt gegen ein Termin-Nomen ("Arzt").
  if (forcedKind !== 'termin' && wantsTask) {
    return {
      kind: 'task',
      title: cleanTitle(amountHit.rest, 'Aufgabe'),
      dueDate: date ? dayKey(date) : null,
      priority,
      recurring: detectRecurring(bodyLower, 'task'),
    }
  }

  // ---------- Termin ----------
  if (wantsEvent || date || time) {
    const birthday = /\b(geburtstag|jahrestag)\b/i.test(bodyLower)
    let eventDate = date ?? now
    // Geburtstage mit Geburtsjahr ("12.03.1928") als nächsten Jahrestag anlegen;
    // das historische Jahr hilft der App nicht und würde im Formular verwirren.
    if (birthday && date && date < startOfDay(now)) {
      const thisYear = new Date(now.getFullYear(), date.getMonth(), date.getDate())
      eventDate = thisYear < startOfDay(now)
        ? new Date(now.getFullYear() + 1, date.getMonth(), date.getDate())
        : thisYear
    }
    const detected = detectRecurring(bodyLower, 'event')
    // Termine kennen jährlich, monatlich und wöchentlich – aber kein "täglich".
    const eventRecurring = birthday ? 'YEARLY' : detected === 'DAILY' ? 'NONE' : detected
    return {
      kind: 'event',
      title: cleanTitle(amountHit.rest, 'Termin'),
      date: dayKey(eventDate),
      time,
      place: null,
      priority,
      yearly: eventRecurring === 'YEARLY',
      recurring: eventRecurring,
    }
  }

  // ---------- Notiz oder Aufgabe ----------
  if (text.length > 70) {
    const words = text.split(' ').slice(0, 5).join(' ')
    return { kind: 'note', title: words.slice(0, 60), content: text.slice(0, 4000) }
  }

  return {
    kind: 'task',
    title: cleanTitle(text, text),
    dueDate: null,
    priority,
    recurring: detectRecurring(bodyLower, 'task'),
  }
}
