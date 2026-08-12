<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import OnlineLobby from '@/components/studyroom/OnlineLobby.vue'
import OnlineRoomView from '@/components/studyroom/OnlineRoomView.vue'
import { useStudyRoomStore } from '@/stores/studyRoom'
import { useStudyRoomOnlineStore } from '@/stores/studyRoomOnline'

// 本地 store 只留名片相关（昵称校验、加油动作表），房间状态一律以服务器为准
const store = useStudyRoomStore()
const online = useStudyRoomOnlineStore()

onMounted(() => {
  void store.init()
  void online.init()
})

onUnmounted(() => {
  store.dispose()
  online.dispose()
})
</script>

<template>
  <div class="page study-room-page">
    <OnlineRoomView v-if="online.inRoom" />
    <OnlineLobby v-else />
  </div>
</template>
