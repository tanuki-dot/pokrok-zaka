import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Settings2, ShieldCheck } from 'lucide-react'
import { Button, Card, PageHeader, Select } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LOGOUT_OPTIONS, setIdleMinutes, useIdleMinutes } from '../lib/autologout'
import { remoteEnabled } from '../lib/remote'
import { resetDemo, setRole, useDB } from '../lib/store'
import { openPrivacy } from '../lib/privacy'

/** Nastavení aplikace: vzhled, automatické odhlášení, soukromí a (v demu) ukázková data a role. */
export default function Settings() {
  const db = useDB()
  const nav = useNavigate()
  const idleMin = useIdleMinutes()
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div>
      <PageHeader icon={<Settings2 size={28} />} title="Nastavení" subtitle="Vzhled, přihlášení a soukromí. Nastavení platí jen v tomto prohlížeči." />

      <div className="grid max-w-2xl gap-4">
        <Card title="Vzhled">
          <p className="mb-3 text-sm text-ink-soft">Světlý, tmavý, nebo podle nastavení systému.</p>
          <div className="max-w-xs"><ThemeToggle /></div>
        </Card>

        {remoteEnabled && (
          <Card title="Automatické odhlášení">
            <p className="mb-3 text-sm text-ink-soft">Po této době nečinnosti vás aplikace odhlásí. Pro další přihlášení bude potřeba znovu zadat heslo.</p>
            <Select
              id="auto-odhlaseni"
              className="max-w-xs"
              value={idleMin}
              onChange={(e) => setIdleMinutes(Number(e.target.value))}
            >
              {LOGOUT_OPTIONS.map((m) => (
                <option key={m} value={m}>po {m} min nečinnosti</option>
              ))}
            </Select>
          </Card>
        )}

        <Card title="Soukromí">
          <p className="mb-3 text-sm text-ink-soft">Aplikace nepoužívá cookies ani reklamní či analytické služby.</p>
          <Button onClick={openPrivacy}><ShieldCheck size={16} /> Zobrazit informace o soukromí</Button>
        </Card>

        {!remoteEnabled && (
          <>
            <Card title="Role (ukázka)">
              <p className="mb-3 text-sm text-ink-soft">Vyzkoušejte rozhraní učitele nebo vedení školy.</p>
              <Select
                id="role"
                className="max-w-xs"
                value={db.settings.role}
                onChange={(e) => {
                  const r = e.target.value as 'ucitel' | 'vedeni'
                  setRole(r)
                  nav(r === 'ucitel' ? '/prehled' : '/vedeni')
                }}
              >
                <option value="ucitel">Učitel/ka</option>
                <option value="vedeni">Vedení školy</option>
              </Select>
            </Card>

            <Card title="Ukázková data">
              <p className="mb-3 text-sm text-ink-soft">Vrátí fiktivní třídy a žáky do původního stavu. Vaše změny se ztratí.</p>
              <Button variant="danger" onClick={() => setConfirmReset(true)}><RotateCcw size={16} /> Obnovit ukázková data</Button>
            </Card>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Obnovit ukázková data?"
        message="Fiktivní třídy a žáci se vrátí do původního stavu a vaše dosavadní změny se ztratí."
        confirmLabel="Obnovit"
        cancelLabel="Zrušit"
        tone="danger"
        onConfirm={() => { resetDemo(); setConfirmReset(false); nav('/prehled') }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
