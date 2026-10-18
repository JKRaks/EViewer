let fontStylesRequest: Promise<unknown> | undefined
let scheduled = false

/** Also used by image export, which may need the fonts before the idle task runs. */
export function loadInterfaceFonts() {
  return (fontStylesRequest ??= import('@/assets/interface-fonts.css'))
}

/** Keep font CSS and its WOFF2 requests out of the initial render's resource graph. */
export function scheduleInterfaceFonts() {
  if (scheduled) return
  scheduled = true

  const afterLoad = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const load = () => {
          void loadInterfaceFonts().catch((error) => {
            console.warn('界面字体延迟加载失败，继续使用系统字体:', error)
          })
        }
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(load, { timeout: 2500 })
        } else {
          window.setTimeout(load, 300)
        }
      })
    })
  }

  if (document.readyState === 'complete') afterLoad()
  else window.addEventListener('load', afterLoad, { once: true })
}
