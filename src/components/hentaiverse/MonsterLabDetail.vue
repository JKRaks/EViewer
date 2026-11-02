<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { t } from '@/i18n'
import ActionButton from '@/components/primitives/ActionButton.vue'
import SelectField from '@/components/primitives/SelectField.vue'
import TextField from '@/components/primitives/TextField.vue'
import type { HentaiVerseFormData } from '@/core/hentaiverse/model/hentaiVerse'
import type {
  HentaiVerseMonsterDetail,
  HentaiVerseMonsterUpgrade,
} from '@/core/hentaiverse/hentaiVerseServices'

const props = defineProps<{ data: HentaiVerseMonsterDetail; loading?: boolean }>()
const emit = defineEmits<{
  request: [data: HentaiVerseFormData, label: string, description: string]
}>()
const count = ref('1')
const name = ref('')
const skills = reactive<Record<string, string>>({})
watch(
  () => props.data,
  (data) => {
    name.value = ''
    count.value = '1'
    Object.keys(skills).forEach((key) => delete skills[key])
    data.skills?.rows.forEach((row) => {
      skills[row.nameField] = row.name
      row.controls.forEach((control) => {
        skills[control.name] = control.value
      })
    })
  },
  { immediate: true },
)

function request(data: HentaiVerseFormData, label: string, description: string) {
  if (!props.loading)
    emit('request', data, label, `${props.data.name}\n${t(label)}\n${description}`)
}

function upgrade(option: HentaiVerseMonsterUpgrade, kind: 'crystal' | 'chaos') {
  if (option.disabled || !option.value) return
  const hidden = kind === 'crystal' ? props.data.crystalHidden : props.data.chaosHidden
  request(
    {
      ...hidden,
      [`${kind}_upgrade`]: option.value,
      [`${kind}_count`]: count.value === '1' ? (hidden[`${kind}_count`] ?? '') : count.value,
    },
    kind === 'crystal' ? '灌注水晶' : '升级怪物特性',
    `${t(option.label)} · ${t('次数')} ${count.value}\n${t(option.help)}\n${t(option.description)}`,
  )
}

function saveSkills() {
  const form = props.data.skills
  if (!form?.canSave) return
  request(
    { ...form.hidden, ...skills },
    '保存怪物技能',
    form.rows.map((row) => skills[row.nameField] || row.placeholder).join('\n'),
  )
}
</script>

<template>
  <section class="monster-detail">
    <header>
      <h3>{{ data.name }}</h3>
      <p class="section-label">{{ t('怪物状态') }}</p>
      <p class="muted">{{ t(data.summary) }}</p>
    </header>
    <p v-if="data.notice" class="monster-notice">{{ t(data.notice) }}</p>
    <template v-if="!data.skills">
      <section v-if="data.food.length" class="food-section">
        <h4>{{ t('饲料与照料') }}</h4>
        <div class="monster-food">
          <div v-for="food in data.food" :key="food.label">
            <p>{{ t(food.description) }}</p>
            <ActionButton
              :disabled="loading"
              @click="request(food.data, food.label, t(food.description))"
              >{{ t(food.label) }}</ActionButton
            >
          </div>
        </div>
      </section>
      <section class="upgrade-section">
        <h4>{{ t('培养与升级') }}</h4>
        <label class="field count-field"
          >{{ t('升级次数')
          }}<SelectField v-model="count" :disabled="loading"
            ><option value="1">1</option>
            <option value="5">5</option>
            <option value="10">10</option></SelectField
          ></label
        >
        <div class="monster-groups">
          <section v-for="group in data.groups" :key="group.title">
            <h4>{{ t(group.title) }}</h4>
            <div v-for="option in group.upgrades" :key="option.label" class="upgrade-row">
              <div>
                <strong>{{ t(option.label) }}</strong>
                <span class="level-value">{{ t('加成') }} {{ option.level }}</span>
                <p class="upgrade-cost">
                  <span>{{ t('升级消耗与库存') }}</span> {{ t(option.description) }}
                </p>
                <details v-if="option.help" class="upgrade-help">
                  <summary>{{ t('升级说明') }}</summary>
                  <p class="muted">{{ t(option.help) }}</p>
                </details>
              </div>
              <ActionButton
                size="sm"
                :disabled="loading || option.disabled"
                @click="upgrade(option, 'crystal')"
                >{{ t('灌注水晶') }}</ActionButton
              >
            </div>
          </section>
        </div>
        <section v-if="data.perks.length">
          <h4>{{ t('怪物特性') }}</h4>
          <div v-for="option in data.perks" :key="option.label" class="upgrade-row">
            <div>
              <strong>{{ t(option.label) }}</strong>
              <span class="level-value">{{ option.level }}</span>
              <p class="upgrade-cost">
                <span>{{ t('升级消耗与库存') }}</span> {{ t(option.description) }}
              </p>
              <details v-if="option.help" class="upgrade-help">
                <summary>{{ t('升级说明') }}</summary>
                <p class="muted">{{ t(option.help) }}</p>
              </details>
            </div>
            <ActionButton
              size="sm"
              :disabled="loading || option.disabled"
              @click="upgrade(option, 'chaos')"
              >{{ t('升级怪物特性') }}</ActionButton
            >
          </div>
        </section>
      </section>
      <section v-if="data.metrics.length">
        <h4>{{ t('其他属性') }}</h4>
        <dl class="metrics">
          <template v-for="metric in data.metrics" :key="metric.label"
            ><dt>{{ t(metric.label) }}</dt>
            <dd>{{ metric.value }}</dd></template
          >
        </dl>
      </section>
      <section class="monster-manage">
        <label class="field"
          >{{ t('怪物名称')
          }}<TextField
            v-model="name"
            :maxlength="100"
            :disabled="loading || !data.canRename" /></label
        ><ActionButton
          :disabled="loading || !data.canRename || !name.trim()"
          @click="
            request({ ...data.renameHidden, rename_monster: name.trim() }, '命名怪物', name.trim())
          "
          >{{ t('命名怪物') }}</ActionButton
        >
      </section>
      <section v-if="data.deleteData" class="danger-zone">
        <p class="muted">{{ t('删除怪物无法撤销。') }}</p>
        <ActionButton
          variant="destructive"
          :disabled="loading"
          @click="request(data.deleteData, '删除怪物', t('删除怪物无法撤销。'))"
          >{{ t('删除怪物') }}</ActionButton
        >
      </section>
    </template>
    <template v-else>
      <section v-for="row in data.skills.rows" :key="row.nameField" class="skill-row">
        <label class="field"
          >{{ t('技能名称')
          }}<TextField
            v-model="skills[row.nameField]"
            :maxlength="30"
            :placeholder="row.placeholder"
            :disabled="loading"
        /></label>
        <label v-for="control in row.controls" :key="control.name" class="field"
          >{{ t(control.label)
          }}<SelectField
            v-model="skills[control.name]"
            :disabled="loading || control.options.length < 2"
            ><option v-for="option in control.options" :key="option.value" :value="option.value">
              {{ t(option.label) }}
            </option></SelectField
          ></label
        >
        <p>{{ row.details.map((line) => t(line)).join(' · ') }}</p>
      </section>
      <ActionButton :disabled="loading || !data.skills.canSave" @click="saveSkills">{{
        t('保存怪物技能')
      }}</ActionButton>
    </template>
  </section>
</template>

<style scoped>
.monster-detail {
  display: grid;
  gap: 18px;
  min-width: 0;
}
.monster-detail h3,
.monster-detail h4 {
  margin: 0;
}
.monster-detail p {
  margin: 6px 0;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.muted {
  color: var(--muted-foreground);
}
.monster-notice {
  color: var(--warning);
  background: var(--warning-soft);
  padding: 10px 12px;
  border-radius: 6px;
}
.monster-manage {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 16px;
}
.monster-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 24px;
}
.upgrade-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--border-soft);
  padding: 12px 0;
}
.upgrade-row .ui-button {
  flex-shrink: 0;
}
.field {
  display: grid;
  gap: 7px;
  min-width: 0;
}
.count-field {
  max-width: 180px;
}
.metrics {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  max-width: 420px;
}
.metrics dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.skill-row {
  display: grid;
  gap: 12px;
  max-width: 620px;
  border-bottom: 1px solid var(--border-soft);
  padding-bottom: 16px;
}
.monster-food {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.monster-food > div {
  border: 1px solid var(--border-soft);
  padding: 12px;
  border-radius: 6px;
  min-width: 0;
}
.upgrade-section {
  display: grid;
  gap: 16px;
  border-top: 1px solid var(--border-soft);
  padding-top: 18px;
}
.section-label,
.upgrade-cost > span {
  color: var(--muted-foreground);
  font-size: 12px;
}
.level-value {
  display: block;
  color: var(--muted-foreground);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.upgrade-row > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.upgrade-help summary {
  cursor: pointer;
  color: var(--muted-foreground);
  display: flex;
  align-items: center;
  gap: 6px;
}
.upgrade-help summary::before {
  content: '+';
}
.upgrade-help[open] summary::before {
  content: '−';
}
.danger-zone {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  border-top: 1px solid var(--border-soft);
  padding-top: 16px;
}
.monster-detail {
  padding-bottom: env(safe-area-inset-bottom);
}
@media (max-width: 767px) {
  .monster-detail :deep(input),
  .monster-detail :deep(select) {
    font-size: 16px;
  }
  .monster-groups,
  .monster-food {
    grid-template-columns: 1fr;
  }
  .monster-detail :deep(.ui-button),
  .monster-detail :deep(input),
  .monster-detail :deep(select),
  .upgrade-help summary {
    min-height: 44px;
  }
  .upgrade-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }
  .upgrade-row .ui-button,
  .monster-food .ui-button {
    width: 100%;
  }
  .monster-manage .ui-button,
  .danger-zone .ui-button {
    flex: 1 1 150px;
  }
  .count-field {
    max-width: none;
  }
  .monster-manage .field {
    flex: 1 1 100%;
  }
}
</style>
