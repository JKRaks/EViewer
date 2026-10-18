<script setup lang="ts">
import { t } from '@/i18n'

import { onBeforeUnmount, onMounted, ref } from 'vue'
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const root = ref<HTMLElement>()
const visible = ref(false)
const documentVisible = ref(!document.hidden)
let observer: IntersectionObserver | undefined
const syncVisibility = () => {
  documentVisible.value = !document.hidden
}
onMounted(() => {
  observer = new IntersectionObserver((entries) => {
    visible.value = entries.some((entry) => entry.isIntersecting)
  })
  if (root.value) observer.observe(root.value)
  document.addEventListener('visibilitychange', syncVisibility)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('visibilitychange', syncVisibility)
})
</script>
<template>
  <div
    ref="root"
    class="camp-scene"
    :class="{ compact, 'is-paused': !visible || !documentVisible }"
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 800 210"
      preserveAspectRatio="xMidYMid slice"
      shape-rendering="crispEdges"
      focusable="false"
    >
      <defs>
        <linearGradient id="camp-sky" x2="0" y2="1">
          <stop stop-color="#17313b" />
          <stop offset="1" stop-color="#54756d" />
        </linearGradient>
        <pattern id="camp-stars" width="140" height="90" patternUnits="userSpaceOnUse">
          <path d="M17 15h2v2h-2zm63 29h2v2h-2zm41-28h2v2h-2z" fill="#c7d9bc" opacity=".55" />
        </pattern>
        <g id="camp-pine">
          <path d="M20 0h8v8h8v8h8v8h-8v8h12v8H0v-8h12v-8H4v-8h8V8h8z" fill="currentColor" />
          <path d="M20 40h8v16h-8z" fill="#314c42" />
        </g>
      </defs>
      <path fill="url(#camp-sky)" d="M0 0h800v210H0z" />
      <path fill="url(#camp-stars)" d="M0 0h800v130H0z" />
      <path d="M612 23h23v5h6v22h-7v6h-23v-6h-7V29h8z" fill="#d8e3c5" />
      <path d="M612 23h16v7h-10v13h-7V30h1z" fill="#9fb7a3" />
      <path
        d="M0 110h60V98h40V87h45v12h60v21h90v-9h52V98h70v15h68v-10h48V90h55v12h62v9h150v99H0z"
        fill="#3c6056"
      />
      <g color="#294c42">
        <use href="#camp-pine" x="22" y="67" transform="scale(1.2)" />
        <use href="#camp-pine" x="120" y="90" />
        <use href="#camp-pine" x="208" y="70" />
        <use href="#camp-pine" x="490" y="81" />
        <use href="#camp-pine" x="684" y="56" />
        <use href="#camp-pine" x="748" y="89" />
      </g>
      <path d="M0 158h72v-9h100v12h154v-6h126v-9h104v9h115v-7h129v62H0z" fill="#213f35" />
      <path d="M240 210v-14h44v-9h42v-11h69v-10h58v10h-43v11h-64v12h-49v11z" fill="#64836c" />
      <path d="M393 132h38v8h8v32h-61v-17h8v-14h7z" fill="#9cae86" />
      <path d="M393 140h31v8h9v24h-47v-18h7z" fill="#c2cda3" />
      <path d="M411 147h8v25h-8z" fill="#3e5943" />
      <path d="M464 170h34v4h-34zm-5 8h43v5h-43z" fill="#8c7760" />
      <g class="camp-flame">
        <path d="M477 148h7v-9h6v17h7v15h-29v-13h9z" fill="#d78a54" />
        <path d="M480 155h7v16h-13v-8h6z" fill="#f4cf7b" />
      </g>
      <path d="M535 140h15v7h6v13h-7v16h-6v-13h-9v-16h1z" fill="#b5c7b1" />
      <path d="M535 138h15v7h-15zm-3 16h18v10h-18z" fill="#5b8b8c" />
      <path d="M537 144h11v7h-11z" fill="#d5bb9b" />
      <path d="M556 144h4v28h-4z" fill="#a3b7a6" />
      <g color="#162e28">
        <use href="#camp-pine" x="10" y="85" transform="scale(1.8)" />
        <use href="#camp-pine" x="408" y="75" transform="scale(1.6)" />
      </g>
      <path d="M0 200h800v10H0z" fill="#172f27" />
      <path d="M178 183h5v3h-5zm433-11h6v3h-6zM70 196h5v3h-5z" fill="#a8bb88" />
    </svg>
    <span class="scene-caption">{{ t('HENTAI VERSE · 冒险手帐') }}</span>
  </div>
</template>
<style scoped>
.camp-scene {
  position: relative;
  overflow: hidden;
  height: 210px;
  margin: 0 0 26px;
  border-radius: 5px;
  background: #17313b;
}
.camp-scene svg {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
.camp-scene.compact {
  height: 92px;
  margin-bottom: 20px;
}
.scene-caption {
  position: absolute;
  bottom: 16px;
  left: 22px;
  color: #dbe8d0;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.4;
  font-synthesis: none;
  letter-spacing: 2px;
  text-shadow: 0 1px 0 #10271f;
}
.camp-flame {
  animation: camp-flicker 2.4s steps(2, end) infinite;
  transform-origin: 484px 171px;
}
.is-paused .camp-flame {
  animation-play-state: paused;
}
@keyframes camp-flicker {
  50% {
    opacity: 0.8;
    transform: scaleY(0.9);
  }
}
@media (max-width: 767px) {
  .camp-scene {
    height: 170px;
    margin-bottom: 18px;
  }
  .camp-scene.compact {
    height: 74px;
  }
  .scene-caption {
    bottom: 12px;
    left: 14px;
    font-size: 11px;
  }
}
</style>
