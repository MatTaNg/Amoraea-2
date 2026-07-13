import { ANTHROPIC_API_KEY, ANTHROPIC_PROXY_URL } from '@features/aria/scoreInterviewModuleConstants';
import { CHAT_ERROR_MESSAGES } from '@features/aria/interviewUserFacingErrors';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

/** Returns false after surfacing proxy error when neither direct API key nor proxy is configured. */
export function assertPreClaudeAnthropicConfigured(deps: PreClaudeTurnGateDeps): boolean {
  if (ANTHROPIC_API_KEY || ANTHROPIC_PROXY_URL) {
    return true;
  }
  deps.setVoiceState('idle');
  deps.showChatError(CHAT_ERROR_MESSAGES.proxyError);
  return false;
}
