import catAttentive from '@/assets/pet/cat-attentive.png'
import catWriting from '@/assets/pet/cat-writing.png'
import catSleeping from '@/assets/pet/cat-sleeping.png'
import catGift from '@/assets/pet/cat-gift.png'
import catIdleMikanAnimation from '@/assets/pet/cat-idle-mikan-animation.webm'
import catIdleCloudAnimation from '@/assets/pet/cat-idle-cloud-animation.webm'
import catIdleSesameAnimation from '@/assets/pet/cat-idle-sesame-animation.webm'
import roomSunroom from '@/assets/pet/room-sunroom.png'
import roomRainy from '@/assets/pet/room-rainy.png'
import roomMoonlit from '@/assets/pet/room-moonlit.png'
import paperStar from '@/assets/pet/items/paper-star.png'
import pressedFlower from '@/assets/pet/items/pressed-flower.png'
import luckyButton from '@/assets/pet/items/lucky-button.png'
import tinyLetter from '@/assets/pet/items/tiny-letter.png'
import paperBall from '@/assets/pet/items/paper-ball.png'
import pencilShavings from '@/assets/pet/items/pencil-shavings.png'
import emptyWrapper from '@/assets/pet/items/empty-wrapper.png'
import floorLamp from '@/assets/pet/items/floor-lamp.png'
import bookCart from '@/assets/pet/items/book-cart.png'
import windowCushion from '@/assets/pet/items/window-cushion.png'
import oakDesk from '@/assets/pet/items/oak-desk.png'

export type PetVisualState = 'idle' | 'focus' | 'paused' | 'break' | 'gift'

export const PET_CAT_IMAGES: Record<PetVisualState, string> = {
  idle: catAttentive,
  focus: catWriting,
  paused: catSleeping,
  break: catSleeping,
  gift: catGift
}

/**
 * 逐帧待机视频已停用：多猫同屏要同时解码多路视频，循环接缝也会顿一下。
 * 现在统一用单帧立绘加轻微 CSS 晃动，这里保留引用只为素材不丢。
 */
export const PET_CAT_IDLE_ANIMATIONS: Record<string, string> = {
  mikan: catIdleMikanAnimation,
  cloud: catIdleCloudAnimation,
  sesame: catIdleSesameAnimation
}

export const PET_ROOM_IMAGES: Record<string, string> = {
  sunroom: roomSunroom,
  rainy: roomRainy,
  moonlit: roomMoonlit
}

export const PET_ITEM_IMAGES: Record<string, string> = {
  'paper-star': paperStar,
  'pressed-flower': pressedFlower,
  'lucky-button': luckyButton,
  'tiny-letter': tinyLetter,
  'paper-ball': paperBall,
  'pencil-shavings': pencilShavings,
  'empty-wrapper': emptyWrapper,
  'floor-lamp': floorLamp,
  'book-cart': bookCart,
  'window-cushion': windowCushion,
  'oak-desk': oakDesk
}

export function catFilter(catId: string): string {
  if (catId === 'cloud') return 'grayscale(0.82) saturate(0.55) brightness(1.03) contrast(0.95)'
  if (catId === 'sesame') return 'grayscale(1) sepia(0.12) brightness(0.52) contrast(1.15)'
  return 'none'
}
