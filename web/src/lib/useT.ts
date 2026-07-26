import { useApp } from '../state'
import { makeT } from './i18n'

/** Translator bound to the app's current UI language. */
export function useT() {
  return makeT(useApp().lang)
}
