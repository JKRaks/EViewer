<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { dialogs } from '@/components/primitives/feedback'
import { t } from '@/i18n'
import ActionButton from '@/components/primitives/ActionButton.vue'
import TextField from '@/components/primitives/TextField.vue'
import NumberField from '@/components/primitives/NumberField.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import MonsterLabDetail from './MonsterLabDetail.vue'
import type { HentaiVerseFormData } from '@/core/hentaiverse/model/hentaiVerse'
import type { HentaiVerseServicesPage } from '@/core/hentaiverse/hentaiVerseServices'

const props = defineProps<{ data: HentaiVerseServicesPage; loading?: boolean }>()
const emit = defineEmits<{
  navigate: [query: Record<string, string>]
  submit: [data: HentaiVerseFormData, label: string]
}>()
const ticketCount = ref(1)
const confirming = ref(false)
let mounted = true
onBeforeUnmount(() => {
  mounted = false
})
const draft = reactive({ to: '', subject: '', body: '' })
const attachment = reactive({ pane: 'item', id: '', count: 1, cod: 0 })
const canRemoveAttachment = computed(() => {
  const mail = props.data.mail
  return (
    mail?.state === 0 || (mail?.state !== undefined && mail.state > 0 && mail.cod !== undefined)
  )
})
watch(
  () => props.data,
  (data) => {
    ticketCount.value = 1
    Object.assign(draft, {
      to: data.mail?.compose?.to || '',
      subject: data.mail?.compose?.subject || '',
      body: data.mail?.compose?.body || '',
    })
    Object.assign(attachment, { pane: 'item', id: '', count: 1, cod: 0 })
  },
  { immediate: true },
)

async function submit(data: HentaiVerseFormData, label: string, detail?: string) {
  if (!mounted || props.loading || confirming.value) return
  const page = props.data
  confirming.value = true
  try {
    await dialogs.confirm(detail || t('确认执行此操作？'), t(label), {
      confirmButtonText: t('确认'),
      cancelButtonText: t('取消'),
      type: 'warning',
    })
  } catch {
    return
  } finally {
    confirming.value = false
  }
  if (mounted && props.data === page && !props.loading) emit('submit', data, label)
}

function lotteryAction(action: 'ticket_count' | 'golden_tickets' | 'prize_optout') {
  const lottery = props.data.lottery
  if (
    !lottery ||
    (action === 'ticket_count' && (!Number.isInteger(ticketCount.value) || ticketCount.value < 1))
  )
    return
  const label =
    action === 'ticket_count'
      ? '购买彩票'
      : action === 'golden_tickets'
        ? '使用黄金彩票'
        : '放弃大奖'
  void submit(
    {
      ...lottery.hidden,
      ticket_count: '',
      golden_tickets: '',
      prize_optout: '',
      [action]: action === 'ticket_count' ? String(ticketCount.value) : '1',
    },
    label,
    action === 'prize_optout'
      ? t('放弃本期大奖后无法恢复。')
      : action === 'ticket_count'
        ? `${lottery.cost} ${t('数量')}：${ticketCount.value}`
        : t('消耗一张黄金彩票，增加本期彩票数量。'),
  )
}

function mailAction(action: string, label: string, extra: HentaiVerseFormData = {}) {
  const mail = props.data.mail
  if (!mail || !mounted || props.loading || confirming.value) return
  const data: HentaiVerseFormData = {
    ...mail.hidden,
    action,
    action_value: '',
    select_item: '',
    select_count: '',
    select_pane: '',
  }
  if (mail.compose)
    Object.assign(data, {
      message_to_name: draft.to,
      message_subject: draft.subject,
      message_body: draft.body,
    })
  Object.assign(data, extra)
  if (action === 'send') {
    if (!draft.to.trim()) return
    const attachments = `${t('附件')}：${mail.attachmentCount ?? t('未知')}；${t('货到付款金额')}：${mail.cod === undefined ? t('源站未提供费用') : `${mail.cod} Credits`}`
    const postage = mail.sendCost === undefined ? t('源站未提供邮资') : `${mail.sendCost} Credits`
    void submit(
      data,
      label,
      `${t('收件人')}：${draft.to}\n${t('主题')}：${draft.subject}\n${t('发送邮件会扣除邮资并交付附件，请确认收件人与内容。')} ${postage}\n${attachments}`,
    )
  } else if (action === 'save') emit('submit', data, label)
  else if (action === 'attach_remove') {
    if (!canRemoveAttachment.value) return
    const item = mail.removable.find((option) => option.index === String(extra.action_value))
    const cost =
      mail.state !== undefined && mail.state > 0 && mail.cod !== undefined && mail.cod > 0
        ? t('领取附件将扣除 {p0} 信用点。', { p0: mail.cod.toLocaleString() })
        : ''
    void submit(data, label, [item?.label || '', cost].filter(Boolean).join('\n'))
  } else if (action === 'attach_add') {
    const item = mail.attachments.find(
      (option) => option.id === String(extra.select_item) && option.pane === extra.select_pane,
    )
    void submit(
      data,
      label,
      `${t(item?.name || String(extra.select_pane))} × ${extra.select_count}${item?.quantity ? `\n${t('库存')}：${item.quantity}` : ''}`,
    )
  } else if (action === 'attach_cod')
    void submit(data, label, `${t('货到付款金额')}：${extra.action_value} Credits`)
  else void submit(data, label)
}

function attach() {
  if (!Number.isInteger(attachment.count) || attachment.count < 1) return
  if (['item', 'equip'].includes(attachment.pane) && !attachment.id) return
  mailAction('attach_add', '添加附件', {
    select_pane: attachment.pane,
    select_item: ['credits', 'hath'].includes(attachment.pane) ? '0' : attachment.id,
    select_count: attachment.pane === 'equip' ? '1' : String(attachment.count),
  })
}

function previewMonsterClass(id: string) {
  const creation = props.data.monsterCreation
  if (!creation || props.loading || confirming.value) return
  emit('submit', { ...creation.hidden, selected_class: id, selected_patk: '' }, '预览怪物类型')
}

function createMonster(attack: string) {
  const creation = props.data.monsterCreation
  if (!creation || !creation.attacks.some((option) => option.value === attack)) return
  const selectedClass = creation.classes.find((option) => option.active)
  const selectedAttack = creation.attacks.find((option) => option.value === attack)
  void submit(
    { ...creation.hidden, selected_patk: attack },
    '创建怪物',
    `${t('创建怪物会占用一个空槽位。')} ${t(selectedClass?.name || '')} · ${t(selectedAttack?.label || '')}`,
  )
}
</script>

<template>
  <section class="hv-services">
    <nav v-if="data.links.length" class="service-actions" :aria-label="t('页面导航')">
      <ActionButton
        v-for="link in data.links"
        :key="`${link.label}:${JSON.stringify(link.query)}`"
        :variant="link.active ? 'default' : 'outline'"
        :disabled="loading || link.disabled"
        :title="link.disabled ? t('此链接的源站参数暂不支持，请在源站查看。') : undefined"
        @click="emit('navigate', link.query)"
        >{{ t(link.label) }}</ActionButton
      >
    </nav>
    <p v-for="notice in data.notices" :key="notice" class="muted">{{ t(notice) }}</p>

    <MonsterLabDetail
      v-if="data.monsterDetail"
      :data="data.monsterDetail"
      :loading="loading || confirming"
      @request="submit"
    />

    <template v-if="data.monsterCreation">
      <h3>{{ t('选择怪物类型') }}</h3>
      <div class="service-actions">
        <ActionButton
          v-for="option in data.monsterCreation.classes"
          :key="option.id"
          :variant="option.active ? 'default' : 'outline'"
          :disabled="loading || confirming || option.active"
          @click="previewMonsterClass(option.id)"
          >{{ t(option.name) }}</ActionButton
        >
      </div>
      <p v-for="description in data.monsterCreation.descriptions" :key="description">
        {{ t(description) }}
      </p>
      <div class="monster-stats">
        <section v-for="group in data.monsterCreation.stats" :key="group.title">
          <h4>{{ t(group.title) }}</h4>
          <dl>
            <template v-for="row in group.rows" :key="row.label"
              ><dt>{{ t(row.label) }}</dt>
              <dd>{{ row.value }}</dd></template
            >
          </dl>
        </section>
      </div>
      <template v-if="data.monsterCreation.attacks.length">
        <h3>{{ t('选择基础攻击类型并创建怪物') }}</h3>
        <p class="muted">{{ t('创建后可命名并培养怪物。') }}</p>
        <div class="service-actions">
          <ActionButton
            v-for="attack in data.monsterCreation.attacks"
            :key="attack.value"
            :disabled="loading || confirming"
            @click="createMonster(attack.value)"
            >{{ t('创建怪物') }} · {{ t(attack.label) }}</ActionButton
          >
        </div>
      </template>
    </template>

    <template v-if="data.lottery">
      <header>
        <p>{{ t(data.lottery.date) }}</p>
        <h3>{{ t(data.lottery.prize) }}</h3>
      </header>
      <div class="lottery-columns">
        <div>
          <ul class="stat-list">
            <li v-for="stat in data.lottery.stats" :key="stat">{{ t(stat) }}</li>
          </ul>
          <p v-for="prize in data.lottery.prizes" :key="prize">{{ t(prize) }}</p>
        </div>
        <div class="purchase">
          <p>{{ t(data.lottery.funds) }}</p>
          <p>{{ t(data.lottery.cost) }}</p>
          <p>{{ t(data.lottery.held) }}</p>
          <p>{{ t(data.lottery.stock) }}</p>
          <label class="field"
            >{{ t('彩票数量')
            }}<NumberField
              v-model="ticketCount"
              :min="1"
              :step="1"
              :disabled="loading || !data.lottery.canBuy"
          /></label>
          <div class="service-actions">
            <ActionButton
              :disabled="
                loading || !data.lottery.canBuy || ticketCount < 1 || !Number.isInteger(ticketCount)
              "
              @click="lotteryAction('ticket_count')"
              >{{ t('购买彩票') }}</ActionButton
            >
            <ActionButton
              variant="outline"
              :disabled="loading || !data.lottery.canGolden"
              @click="lotteryAction('golden_tickets')"
              >{{ t('使用黄金彩票') }}</ActionButton
            >
            <ActionButton
              variant="destructive"
              :disabled="loading || !data.lottery.canOptOut"
              @click="lotteryAction('prize_optout')"
              >{{ t('放弃大奖') }}</ActionButton
            >
          </div>
        </div>
      </div>
      <details class="rules">
        <summary>{{ t('彩票规则') }}</summary>
        <p v-for="rule in data.lottery.rules" :key="rule">{{ t(rule) }}</p>
      </details>
    </template>

    <template v-if="data.mail">
      <div v-if="data.mail.rows.length" class="mail-list">
        <button
          v-for="(row, index) in data.mail.rows"
          :key="index"
          class="mail-row"
          :disabled="loading || !row.query"
          :title="!row.query ? t('此链接的源站参数暂不支持，请在源站查看。') : undefined"
          @click="row.query && emit('navigate', row.query)"
        >
          <span v-for="(column, columnIndex) in row.columns" :key="columnIndex">{{
            t(column)
          }}</span>
        </button>
      </div>
      <p v-else-if="!data.mail.compose && !data.mail.content" class="empty">
        {{ t(data.mail.empty || '暂无邮件') }}
      </p>
      <p v-if="!data.mail.compose && data.mail.content" class="mail-content">
        {{ t(data.mail.content) }}
      </p>
      <div v-if="data.mail.compose" class="compose">
        <label class="field"
          >{{ t('收件人') }}<TextField v-model="draft.to" :maxlength="50" :disabled="loading"
        /></label>
        <label class="field"
          >{{ t('主题') }}<TextField v-model="draft.subject" :maxlength="50" :disabled="loading"
        /></label>
        <label class="field"
          >{{ t('邮件正文')
          }}<TextField v-model="draft.body" type="textarea" :rows="9" :disabled="loading"
        /></label>
        <div class="service-actions">
          <ActionButton
            :disabled="loading || !draft.to.trim()"
            @click="mailAction('send', '发送邮件')"
            >{{ t('发送邮件') }}</ActionButton
          ><ActionButton
            variant="outline"
            :disabled="loading"
            @click="mailAction('save', '保存草稿')"
            >{{ t('保存草稿') }}</ActionButton
          ><ActionButton
            variant="destructive"
            :disabled="loading"
            @click="mailAction('discard', '丢弃邮件')"
            >{{ t('丢弃邮件') }}</ActionButton
          >
        </div>
        <details class="rules">
          <summary>{{ t('添加附件') }}</summary>
          <div class="attachment-fields">
            <label class="field"
              >{{ t('附件类型')
              }}<SelectField
                v-model="attachment.pane"
                :disabled="loading"
                @change="attachment.id = ''"
                ><option value="item">{{ t('物品') }}</option>
                <option value="equip">{{ t('装备') }}</option>
                <option value="credits">Credits</option>
                <option value="hath">Hath</option></SelectField
              ></label
            >
            <label v-if="['item', 'equip'].includes(attachment.pane)" class="field"
              >{{ t('附件')
              }}<SelectField v-model="attachment.id" :disabled="loading"
                ><option value="">{{ t('选择附件') }}</option>
                <option
                  v-for="item in data.mail.attachments.filter(
                    (item) => item.pane === attachment.pane,
                  )"
                  :key="item.id"
                  :value="item.id"
                  :disabled="item.locked"
                >
                  {{ t(item.name) }} {{ item.quantity ? `×${item.quantity}` : '' }}
                </option></SelectField
              ></label
            >
            <label v-if="attachment.pane !== 'equip'" class="field"
              >{{ t('数量')
              }}<NumberField v-model="attachment.count" :min="1" :step="1" :disabled="loading"
            /></label>
          </div>
          <ActionButton
            :disabled="
              loading ||
              (['item', 'equip'].includes(attachment.pane) && !attachment.id) ||
              !Number.isInteger(attachment.count) ||
              attachment.count < 1
            "
            @click="attach"
            >{{ t('添加附件') }}</ActionButton
          >
        </details>
      </div>
      <div v-if="data.mail.removable.length || data.mail.canReturn" class="service-actions">
        <ActionButton
          v-for="item in data.mail.removable"
          :key="item.index"
          variant="outline"
          :disabled="loading || !canRemoveAttachment"
          :title="!canRemoveAttachment ? t('无法确认领取费用，暂不能领取附件。') : undefined"
          @click="
            mailAction('attach_remove', data.mail.state === 0 ? '移除附件' : '领取附件', {
              action_value: item.index,
            })
          "
          >{{ t(data.mail.state === 0 ? '移除附件' : '领取附件') }} ·
          {{ t(item.label) }}</ActionButton
        ><ActionButton
          v-if="data.mail.canReturn"
          variant="destructive"
          :disabled="loading"
          @click="mailAction('return_message', '退回邮件')"
          >{{ t('退回邮件') }}</ActionButton
        >
      </div>
      <div v-if="data.mail.canSetCod" class="service-actions">
        <NumberField
          v-model="attachment.cod"
          :aria-label="t('货到付款金额')"
          :min="0"
          :step="1"
          :disabled="loading"
        /><ActionButton
          :disabled="loading || !Number.isInteger(attachment.cod) || attachment.cod < 0"
          @click="
            mailAction('attach_cod', '设置货到付款', { action_value: String(attachment.cod) })
          "
          >{{ t('设置货到付款') }}</ActionButton
        >
      </div>
      <details v-if="data.mail.help.length" class="rules">
        <summary>{{ t('邮件说明') }}</summary>
        <p v-for="help in data.mail.help" :key="help">{{ t(help) }}</p>
      </details>
    </template>

    <template v-if="data.monsters">
      <p v-if="!data.monsters.length" class="empty">
        {{ t('尚未拥有怪物。解锁槽位后可在实验室创建怪物。') }}
      </p>
      <div v-for="(monster, index) in data.monsters" :key="index" class="monster-row">
        <p>{{ t(monster.name) }}</p>
        <ActionButton
          v-if="monster.query"
          variant="outline"
          :disabled="loading"
          @click="emit('navigate', monster.query)"
          >{{ t(monster.query.create === 'new' ? '创建怪物' : '查看怪物') }}</ActionButton
        >
      </div>
    </template>
    <div v-if="data.actions.length" class="service-actions">
      <ActionButton
        v-for="action in data.actions"
        :key="action.label"
        :disabled="loading || action.disabled"
        :variant="action.danger ? 'destructive' : 'default'"
        @click="
          submit(action.data, action.label, action.description ? t(action.description) : undefined)
        "
        >{{ t(action.label) }}</ActionButton
      >
    </div>
  </section>
</template>

<style scoped>
.hv-services {
  min-width: 0;
  padding: 16px 0;
}
.hv-services h3 {
  font-size: 17px;
  margin: 8px 0 16px;
  overflow-wrap: anywhere;
}
.hv-services p {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.service-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0;
  align-items: center;
}
.lottery-columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
}
.stat-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}
.stat-list li {
  overflow-wrap: anywhere;
}
.field {
  display: grid;
  gap: 7px;
  margin-bottom: 14px;
  min-width: 0;
}
.field :deep(input),
.field :deep(textarea),
.field :deep(select) {
  width: 100%;
  min-width: 0;
}
.rules {
  border-top: 1px solid var(--border-soft);
  padding: 14px 0;
  margin-top: 14px;
}
.rules summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 10px;
}
.muted,
.empty,
.rules p {
  color: var(--muted-foreground);
}
.attachment-fields {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(0, 2fr) minmax(80px, 1fr);
  gap: 12px;
}
.mail-content {
  white-space: pre-wrap;
}
.mail-row {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr 1fr;
  gap: 10px;
  text-align: left;
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border-soft);
  padding: 12px 0;
  color: inherit;
  cursor: pointer;
}
.mail-row span {
  overflow-wrap: anywhere;
  min-width: 0;
}
.monster-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-soft);
  gap: 12px;
}
.monster-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 18px;
}
.monster-stats h4 {
  margin: 0 0 10px;
}
.monster-stats dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  margin: 0;
}
.monster-stats dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 767px) {
  .lottery-columns,
  .attachment-fields {
    grid-template-columns: 1fr;
  }
  .service-actions > .ui-button {
    flex: 1 1 130px;
  }
  .field :deep(input),
  .field :deep(textarea),
  .field :deep(select) {
    font-size: 16px;
  }
  .mail-row {
    grid-template-columns: 1fr 2fr;
  }
}
</style>
