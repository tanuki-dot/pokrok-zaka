import * as XLSX from 'xlsx'
import type { DB } from './types'
import { fullName } from './util'
import { KIND_LABEL } from './dates'

/** Řádky pro export – jedna řada = jedno hodnocení, kritéria jako sloupce. */
export function buildSheets(db: DB, subjectId: string | 'vse') {
  const subjects = subjectId === 'vse' ? db.subjects : db.subjects.filter((s) => s.id === subjectId)
  const sIds = new Set(subjects.map((s) => s.id))
  const as = db.assessments.filter((a) => sIds.has(a.subjectId)).sort((a, b) => a.date.localeCompare(b.date))
  const crit = db.criteria.filter((c) => c.subjectId === null || sIds.has(c.subjectId))
  const st = (id: string) => db.students.find((s) => s.id === id)
  const cl = (id?: string) => db.classes.find((c) => c.id === id)?.name ?? ''
  const sub = (id: string) => db.subjects.find((s) => s.id === id)?.name ?? ''

  const hodnoceni = as.map((a) => {
    const s = st(a.studentId)
    const self = db.selfAssessments.find((x) => x.assessmentId === a.id)
    const row: Record<string, string | number> = {
      Datum: a.date,
      Hodina: a.lesson ?? '',
      Třída: cl(s?.classId),
      Předmět: sub(a.subjectId),
      Žák: s ? fullName(s) : '',
      Téma: a.topic,
      Cíl: a.goal,
      'Kritérium úspěchu': a.successCriterion,
    }
    for (const c of crit) row[c.name] = a.scores[c.id] ?? ''
    Object.assign(row, {
      'Co se povedlo': a.feedback.good,
      'Co procvičit': a.feedback.todo,
      'Další krok': a.feedback.next,
      'SWOT – silné stránky': a.swot.s,
      'SWOT – oblasti ke zlepšení': a.swot.w,
      'SWOT – příležitosti': a.swot.o,
      'SWOT – překážky': a.swot.t,
      'Další cíl': a.nextGoal,
      'Sebehodnocení: co jsem se naučil': self?.learned ?? '',
      'Sebehodnocení: s čím potřebuji pomoc': self?.needHelp ?? '',
    })
    return row
  })

  const cile = db.goals
    .filter((g) => sIds.has(g.subjectId))
    .map((g) => {
      const s = st(g.studentId)
      return { Žák: s ? fullName(s) : '', Třída: cl(s?.classId), Předmět: sub(g.subjectId), Cíl: g.text, Stanoveno: g.setOn, Termín: g.due, Stav: g.status }
    })

  const souhrny = db.summaries
    .filter((x) => sIds.has(x.subjectId) && x.status === 'schvaleno')
    .map((x) => {
      const s = st(x.studentId)
      return {
        Žák: s ? fullName(s) : '',
        Předmět: sub(x.subjectId),
        Typ: KIND_LABEL[x.kind],
        Od: x.from,
        Do: x.to,
        Verze: x.version,
        Text: x.sections.map((sec) => `${sec.title}: ${sec.sentences.map((y) => y.text).join(' ')}`).join('\n') + (x.teacherNote ? `\nKomentář: ${x.teacherNote}` : ''),
      }
    })
  return { hodnoceni, cile, souhrny }
}

export function exportXlsx(db: DB, subjectId: string | 'vse', fileName: string) {
  const { hodnoceni, cile, souhrny } = buildSheets(db, subjectId)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hodnoceni), 'Hodnocení')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cile), 'Cíle')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(souhrny), 'Schválené souhrny')
  XLSX.writeFile(wb, fileName)
}

export function exportCsv(db: DB, subjectId: string | 'vse', fileName: string) {
  const { hodnoceni } = buildSheets(db, subjectId)
  const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(hodnoceni), { FS: ';' })
  download(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), fileName)
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
