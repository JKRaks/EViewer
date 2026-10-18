import {
  computed,
  defineComponent,
  h,
  Fragment,
  nextTick,
  onMounted,
  ref,
  watch,
  type VNode,
  type Slots,
  provide,
  type InjectionKey,
  type ComputedRef,
} from 'vue'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const activeSection: InjectionKey<ComputedRef<string | number>> = Symbol('active-section')
function panels(nodes: VNode[]): VNode[] {
  return nodes.flatMap((node) =>
    node.type === Fragment && Array.isArray(node.children)
      ? panels(node.children as VNode[])
      : typeof node.type === 'object'
        ? [node]
        : [],
  )
}

export default defineComponent({
  name: 'SectionTabs',
  props: { modelValue: { type: [String, Number], default: undefined } },
  emits: ['update:modelValue', 'tab-change'],
  setup(props, { slots, emit, attrs }) {
    const fallback = ref<string | number>('')
    const value = computed(() => props.modelValue ?? fallback.value)
    const root = ref<{ $el: HTMLElement }>()
    function revealActive() {
      const item = root.value?.$el.querySelector<HTMLElement>('.ui-tabs__item[data-state="active"]')
      const nav = item?.parentElement
      if (
        nav &&
        item &&
        (item.offsetLeft < nav.scrollLeft ||
          item.offsetLeft + item.offsetWidth > nav.scrollLeft + nav.clientWidth)
      ) {
        nav.scrollLeft = Math.max(0, item.offsetLeft - nav.offsetLeft - 12)
      }
    }
    onMounted(() => void nextTick(revealActive))
    watch(value, () => void nextTick(revealActive))
    provide(activeSection, value)
    function select(next: string | number) {
      fallback.value = next
      emit('update:modelValue', next)
      emit('tab-change', next)
    }
    return () => {
      const nodes = panels(slots.default?.() ?? [])
      if (!value.value && nodes[0]?.props?.name !== undefined) fallback.value = nodes[0].props.name
      return h(
        Tabs,
        {
          ...attrs,
          ref: root,
          modelValue: value.value,
          'onUpdate:modelValue': select,
          class: ['ui-tabs', attrs.class],
        },
        {
          default: () => [
            h(
              TabsList,
              { class: 'ui-tabs__nav' },
              {
                default: () =>
                  nodes.map((node) => {
                    const content = node.children as Slots
                    return h(
                      TabsTrigger,
                      {
                        value: node.props?.name,
                        disabled: node.props?.disabled,
                        class: 'ui-tabs__item',
                      },
                      { default: () => content?.label?.() ?? node.props?.label },
                    )
                  }),
              },
            ),
            ...nodes,
          ],
        },
      )
    }
  },
})
