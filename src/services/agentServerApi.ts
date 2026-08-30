export interface AgentServerStatus {
  enabled: boolean;
  port: number;
  running: boolean;
  apiKey: string;
}

class AgentServerService {
  async getStatus(): Promise<AgentServerStatus> {
    const res = await fetch('/api/agent-server/status');
    if (!res.ok) throw new Error(`Failed to fetch agent server status: HTTP ${res.status}`);
    return res.json();
  }

  async setConfig(config: { enabled?: boolean; port?: number }): Promise<AgentServerStatus> {
    const res = await fetch('/api/agent-server/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update agent server configuration');
    }
    return this.getStatus();
  }

  async regenerateKey(): Promise<string> {
    const res = await fetch('/api/agent-server/regenerate-key', { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to regenerate API key');
    }
    return data.apiKey;
  }
}

export const agentServerService = new AgentServerService();
