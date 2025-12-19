<!--
  CredentialNode - OSINT Category
  
  Credential/secret data (masked by default).
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { CredentialNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { Key, Eye, EyeOff, Copy, AlertTriangle } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type CredentialNodeType = Node<CredentialNodeData, 'credential'>;

  let { data, selected, id }: NodeProps<CredentialNodeType> = $props();
  
  let showPassword = $state(false);
  let copied = $state(false);

  function updateField(field: keyof CredentialNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function copyField(value: string | undefined) {
    if (value) {
      navigator.clipboard.writeText(value);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }

  const maskedPassword = $derived(data.password ? '•'.repeat(data.password.length) : '');
</script>

<NodeWrapper {data} {selected} {id} nodeType="credential" class="credential-node">
  {#snippet header()}
    <span class="node-icon"><Key size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.title}</span>
  {/snippet}
  
  <div class="security-warning">
    <AlertTriangle size={12} />
    <span>Sensitive Data</span>
  </div>
  
  <NodeField 
    label="Service"
    value={data.service || ''}
    placeholder="Service name"
    oninput={(v) => updateField('service', v)}
  />
  
  <NodeField 
    label="Username"
    value={data.username || ''}
    placeholder="Username/email"
    oninput={(v) => updateField('username', v)}
  />
  
  <div class="password-field">
    <label class="field-label" for="cred-password">Password</label>
    <div class="password-input-wrapper">
      <input
        id="cred-password"
        type={showPassword ? 'text' : 'password'}
        class="password-input nodrag"
        value={data.password || ''}
        placeholder="••••••••"
        oninput={(e) => updateField('password', (e.target as HTMLInputElement).value)}
      />
      <button class="toggle-visibility" onclick={() => showPassword = !showPassword} type="button">
        {#if showPassword}
          <EyeOff size={14} />
        {:else}
          <Eye size={14} />
        {/if}
      </button>
      <button class="copy-btn" onclick={() => copyField(data.password as string)} type="button">
        <Copy size={14} />
      </button>
    </div>
  </div>
  
  {#if data.source}
    <div class="credential-source">
      <span class="label">Source:</span>
      <span class="value">{data.source}</span>
    </div>
  {/if}
  
  {#if data.compromised}
    <div class="compromised-badge">
      <AlertTriangle size={12} />
      COMPROMISED
    </div>
  {/if}
</NodeWrapper>

<style>
  .security-warning {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 4px;
    font-size: 10px;
    color: #f59e0b;
    margin-bottom: 12px;
  }

  .password-field {
    margin-bottom: 8px;
  }

  .field-label {
    display: block;
    font-size: 10px;
    color: #888;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .password-input-wrapper {
    display: flex;
    gap: 4px;
  }

  .password-input {
    flex: 1;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 12px;
    font-family: monospace;
    outline: none;
  }

  .password-input:focus {
    border-color: #3b82f6;
  }

  .toggle-visibility,
  .copy-btn {
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #444;
    border-radius: 4px;
    color: #888;
    cursor: pointer;
  }

  .toggle-visibility:hover,
  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .credential-source {
    margin-top: 8px;
    font-size: 11px;
    color: #666;
  }

  .credential-source .label {
    color: #555;
  }

  .compromised-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 6px 10px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 4px;
    font-size: 10px;
    font-weight: 600;
    color: #ef4444;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
</style>
