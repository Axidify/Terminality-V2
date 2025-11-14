export const ONLINE_CHAT_FOCUS_EVENT = 'terminality:onlineChat:focus-room'

export interface OnlineChatFocusPayload {
  room?: string
  dmPeer?: { id: number; username: string }
  messageId?: number
}
