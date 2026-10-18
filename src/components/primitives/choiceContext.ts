import type { ComputedRef, InjectionKey } from 'vue'
export type ChoiceValue = string | number | boolean
export const choiceContext: InjectionKey<{
  name: string
  value: ComputedRef<ChoiceValue | undefined>
  disabled: ComputedRef<boolean>
  select: (value: ChoiceValue) => void
}> = Symbol('choice')
export const fieldLabel: InjectionKey<string> = Symbol('field-label')
export const checkContext: InjectionKey<{
  value: ComputedRef<ChoiceValue[]>
  disabled: ComputedRef<boolean>
  toggle: (value: ChoiceValue, selected: boolean) => void
}> = Symbol('checks')
