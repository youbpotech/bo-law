import type { NotificationChannel } from '../entities/Notification'
import type { NotificationChannelAdapter } from './contracts'

export class NotificationChannelFactory {
  private readonly adapters = new Map<NotificationChannel, NotificationChannelAdapter>()

  register(adapter: NotificationChannelAdapter): this {
    if (this.adapters.has(adapter.channel)) {
      throw new Error(`Já existe um adapter para o canal ${adapter.channel}`)
    }
    this.adapters.set(adapter.channel, adapter)
    return this
  }

  get(channel: NotificationChannel): NotificationChannelAdapter {
    const adapter = this.adapters.get(channel)
    if (!adapter) throw new Error(`Não existe adapter configurado para o canal ${channel}`)
    return adapter
  }

  has(channel: NotificationChannel): boolean {
    return this.adapters.has(channel)
  }
}
