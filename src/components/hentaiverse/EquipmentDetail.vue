<script setup lang="ts">
import { t } from '@/i18n'

import { computed } from 'vue'
import type { HentaiVerseEquipmentDetail } from '@/core/hentaiverse/model/hentaiVerse'
import { getEquipmentHighlights } from '@/core/hentaiverse/hentaiVerseEquipment'
const props = defineProps<{ data: HentaiVerseEquipmentDetail }>()
const highlights = computed(() => getEquipmentHighlights(props.data))
</script>

<template>
  <section class="equipment-detail" :aria-label="t('{p0}的属性', { p0: t(data.name) })">
    <div class="equipment-overview">
      <span v-if="data.summary" class="equipment-summary">{{ t(data.summary) }}</span>
      <span v-for="status in data.status" :key="status" class="equipment-state">{{
        t(status)
      }}</span>
    </div>
    <p v-if="highlights.length" class="equipment-highlights">
      <span
        v-for="metric in highlights"
        :key="`${metric.group}:${metric.label}`"
        :title="t(metric.group)"
        >{{ t(metric.label) }} {{ t(metric.value) }}</span
      >
    </p>
    <p v-for="effect in data.effects" :key="effect" class="equipment-effect">{{ t(effect) }}</p>
    <details>
      <summary>{{ t('完整属性') }}</summary>
      <section v-for="group in data.groups" :key="group.title" class="equipment-stat-group">
        <h4>{{ t(group.title) }}</h4>
        <dl>
          <template v-for="metric in group.metrics" :key="metric.label">
            <dt>{{ t(metric.label) }}</dt>
            <dd>
              {{ t(metric.value) }}
              <small v-if="metric.base">{{ t('基础值 {p0}', { p0: metric.base }) }}</small>
            </dd>
          </template>
        </dl>
      </section>
    </details>
  </section>
</template>

<style scoped>
.equipment-detail {
  min-width: 0;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
  color: var(--muted-foreground);
}
.equipment-overview {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
}
.equipment-state {
  color: var(--foreground);
}
p {
  margin: 4px 0;
}
.equipment-effect {
  color: var(--foreground);
}
.equipment-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}
details {
  margin-top: 2px;
}
summary {
  width: fit-content;
  padding: 4px 0;
  cursor: pointer;
  color: var(--accent);
}
h4 {
  margin: 12px 0 6px;
  font-size: 12px;
  color: var(--foreground);
}
dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  gap: 6px 12px;
  margin: 0;
}
dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
small {
  display: block;
  font-size: 11px;
  color: var(--placeholder);
}
@media (max-width: 767px) {
  .equipment-detail {
    font-size: 13px;
  }
  h4 {
    font-size: 14px;
  }
  small {
    font-size: 12px;
  }
  summary {
    min-height: 44px;
    align-content: center;
  }
}
</style>
