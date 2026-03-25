export function getLiveAgentConfig() {
  const configured = Boolean(process.env.ELEVENLABS_AGENT_ID);
  const requiresAuth = process.env.ELEVENLABS_AGENT_REQUIRES_AUTH !== 'false';

  return {
    configured,
    requiresAuth,
    agentId: configured && !requiresAuth ? process.env.ELEVENLABS_AGENT_ID : null,
  };
}
