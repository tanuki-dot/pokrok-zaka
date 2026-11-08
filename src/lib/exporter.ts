import * as XLSX from 'xlsx'
import type { DB } from './types'
import { fullName } from './util'
import { KIND_LABEL } from './dates'
import { GOAL_STATUS_LABEL } from './analysis'
import { describeSelf } from './questionnaire'
import { periodLabel, PERIOD_LABEL } from './periods'

/** Řádky pro export – jedna řada = jedno hodnocení, dovednosti jako sloupce (1 = výborně … 5 = zatím nezvládá, prázdné = nehodnoceno). */
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
      Třída: cl(s?.classId),
      Předmět: sub(a.subjectId),
      Žák: s ? fullName(s) : '',
      'Typ období': PERIOD_LABEL[a.periodType],
      Období: periodLabel(a.periodType, a.periodFrom, a.periodTo),
      'Tematické celky': a.units.map((id) => db.units.find((u) => u.id === id)?.name ?? '').filter(Boolean).join('; '),
      Téma: a.topic,
      'Vzdělávací cíle': a.goals.map((g) => `${g.text} (${g.status ? GOAL_STATUS_LABEL[g.status] : 'neoznačeno'})`).join('; '),
      Stav: a.status === 'dokoncene' ? 'dokončeno' : 'rozpracováno',
    }
    for (const c of crit) row[c.name] = a.scores[c.id] ?? ''
    Object.assign(row, {
      'Co se povedlo': a.feedback.good,
      'Co procvičit': a.feedback.todo,
      'Další krok': a.feedback.next,
      'Co žák zvládá': a.swot.s,
      'Co potřebuje zlepšit': a.swot.w,
      'Možnosti dalšího rozvoje': a.swot.o,
      'Překážky v učení': a.swot.t,
      'Formativní hodnocení': a.report?.text ?? '',
      'Formativní hodnocení schváleno': a.report?.approved ? 'ano' : 'ne',
      'Další cíl': a.nextGoal,
      'Sebehodnocení: porozumění': self?.answers ? describeSelf(self).understanding : '',
      'Sebehodnocení: práce': self?.answers ? describeSelf(self).work : '',
      'Sebehodnocení: povedlo se': self?.answers ? describeSelf(self).wentWell.join(' ') : self?.wentWell ?? '',
      'Sebehodnocení: zlepšit': self?.answers ? describeSelf(self).improve.join(' ') : self?.needHelp ?? '',
      'Sebehodnocení: cíle': self?.answers ? describeSelf(self).goalMet : '',
      'Sebehodnocení: vlastní odpověď': self?.answers ? self.answers.nextWish : self?.nextWant ?? '',
      Přílohy: db.attachments.filter((x) => x.assessmentId === a.id).map((x) => x.name).join('; '),
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
