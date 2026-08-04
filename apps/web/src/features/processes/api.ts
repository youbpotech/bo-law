import { authRequest } from '@/composables/useApi'
import type { ProcessStakeholderCandidate } from './types'

export function fetchProcessStakeholderCandidates(): Promise<ProcessStakeholderCandidate[]> {
  return authRequest<ProcessStakeholderCandidate[]>('/api/process-stakeholders/candidates')
}
