/*
 * Úvodní obrazovka (#splash v index.html).
 * Zatím se ukazuje pevně nejméně 0,5 s od otevření stránky. Později se délka
 * bude řídit odezvou serveru – stačí upravit splashDuration().
 */

export const SPLASH_MIN_MS = 500

/** Jak dlouho (ms od otevření stránky) má úvodní obrazovka nejméně zůstat. */
export function splashDuration(): number {
  // TODO: změřit odezvu (ping) a podle ní délku prodloužit.
  return SPLASH_MIN_MS
}

/** Skryje úvodní obrazovku, jakmile uplyne splashDuration() od otevření stránky. */
export function hideSplash() {
  const el = document.getElementById('splash')
  if (!el) return
  // performance.now() běží od začátku načítání stránky, takže se čas načtení započítá.
  const wait = Math.max(0, splashDuration() - performance.now())
  window.setTimeout(() => {
    el.classList.add('splash-hide')
    // Po doběhnutí přechodu prvek odstranit (pojistka i bez transitionend).
    el.addEventListener('transitionend', () => el.remove(), { once: true })
    window.setTimeout(() => el.remove(), 400)
  }, wait)
}
