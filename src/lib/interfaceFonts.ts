let fontStylesRequest: Promise<unknown> | undefined

/** Shared by startup and image export; concurrent callers reuse the same stylesheet request. */
export function loadInterfaceFonts() {
  return (fontStylesRequest ??= import('@/assets/interface-fonts.css'))
}
