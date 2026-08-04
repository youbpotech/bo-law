import { describe, expect, it } from 'vitest'
import { notify } from './service'

describe('serviço de notificações', () => {
  it('não cria entregas SMS enquanto o adapter não existir', async () => {
    await expect(
      notify({
        companyId: 1,
        channels: ['sms'],
        recipient: { userId: '00000000-0000-4000-8000-000000000001' },
        title: 'Teste',
        body: 'Mensagem',
      }),
    ).rejects.toThrow('canal sms ainda não possui implementação')
  })
})
