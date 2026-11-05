import { useSyncExternalStore } from 'react'
import type { DB } from './types'
import { setSchoolType } from './store'

/** Vybraná třída a předmět – sdílené mezi obrazovkami (KROK 1: ZŠ/SŠ → třída → předmět). */
export interface Selection {
  classId: string
  subjectId: string
}

const KEY = 'pokrok-zaka:vyber'
let sel: Selection = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '') as Selection
  } catch {
    return { classId: 'c-me1', subjectId: 'p-me1-inf' }
  }
})()
const ls = new Set<() => void>()

export function setSelection(next: Partial<Selection>) {
  sel = { ...sel, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify(sel))
  } catch {
    /* jen pohodlí */
  }
  ls.forEach((l) => l())
}

export function useSelectionRaw() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    () => sel,
  )
}

/** Vrátí platný výběr pro aktuální data (opraví neexistující třídu/předmět). */
export function resolveSelection(d: DB, s: Selection) {
  const type = d.settings.schoolType
  const classes = d.classes.filter((c) => d.schools.find((x) => x.id === c.schoolId)?.type === type)
  const cls = classes.find((c) => c.id === s.classId) ?? classes[0]
  const subjects = cls ? d.subjects.filter((p) => p.classId === cls.id) : []
  const subj = subjects.find((p) => p.id === s.subjectId) ?? subjects[0]
  const students = cls
    ? d.students.filter((x) => x.classId === cls.id).sort((a, b) => a.lastName.localeCompare(b.lastName, 'cs'))
    : []
  return { type, classes, cls, subjects, subj, students }
}

export function switchSchoolType(d: DB, type: DB['settings']['schoolType']) {
  setSchoolType(type)
  const cls = d.classes.find((c) => d.schools.find((x) => x.id === c.schoolId)?.type === type)
  const subj = cls ? d.subjects.find((p) => p.classId === cls.id) : undefined
  setSelection({ classId: cls?.id ?? '', subjectId: subj?.id ?? '' })
}
