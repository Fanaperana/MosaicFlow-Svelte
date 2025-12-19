<!--
  SocialPostNode - OSINT Category
  
  Social media post/comment reference.
-->
<script lang="ts">
  import { type NodeProps, type Node } from '@xyflow/svelte';
  import type { SocialPostNodeData } from '$lib/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { MessageCircle, Heart, Repeat2, ExternalLink, Calendar } from 'lucide-svelte';
  import { NodeWrapper, NodeField } from '../_shared';

  type SocialPostNodeType = Node<SocialPostNodeData, 'socialPost'>;

  let { data, selected, id }: NodeProps<SocialPostNodeType> = $props();

  function updateField(field: keyof SocialPostNodeData, value: string) {
    workspace.updateNodeData(id, { [field]: value });
  }

  function openPost() {
    if (data.url) {
      window.open(data.url, '_blank');
    }
  }

  const platformColor = $derived(() => {
    const colors: Record<string, string> = {
      twitter: '#1DA1F2',
      x: '#000000',
      facebook: '#1877F2',
      instagram: '#E4405F',
      linkedin: '#0A66C2',
      reddit: '#FF4500',
      mastodon: '#6364FF',
    };
    return colors[data.platform?.toLowerCase() || ''] || '#666';
  });
</script>

<NodeWrapper {data} {selected} {id} nodeType="socialPost" class="social-post-node">
  {#snippet header()}
    <span class="node-icon"><MessageCircle size={14} strokeWidth={1.5} /></span>
    <span class="node-title">{data.platform || 'Social Post'}</span>
  {/snippet}
  
  {#snippet headerActions()}
    {#if data.url}
      <button class="node-action-btn" onclick={openPost} title="Open post">
        <ExternalLink size={14} strokeWidth={1.5} />
      </button>
    {/if}
  {/snippet}
  
  <div class="post-author">
    {#if data.avatar}
      <img src={data.avatar} alt="" class="author-avatar" />
    {:else}
      <div class="author-avatar-placeholder"></div>
    {/if}
    <div class="author-info">
      <span class="author-name">{data.author || 'Unknown'}</span>
      {#if data.handle}
        <span class="author-handle">{data.handle}</span>
      {/if}
    </div>
  </div>
  
  <div class="post-content">
    {#if data.content}
      <p>{data.content}</p>
    {:else}
      <textarea
        class="content-input nodrag nowheel"
        placeholder="Post content..."
        oninput={(e) => updateField('content', (e.target as HTMLTextAreaElement).value)}
      ></textarea>
    {/if}
  </div>
  
  {#if data.timestamp}
    <div class="post-timestamp">
      <Calendar size={11} />
      <span>{data.timestamp}</span>
    </div>
  {/if}
  
  <div class="post-stats">
    {#if data.likes !== undefined}
      <span class="stat">
        <Heart size={12} />
        {data.likes}
      </span>
    {/if}
    {#if data.reposts !== undefined}
      <span class="stat">
        <Repeat2 size={12} />
        {data.reposts}
      </span>
    {/if}
    {#if data.replies !== undefined}
      <span class="stat">
        <MessageCircle size={12} />
        {data.replies}
      </span>
    {/if}
  </div>
</NodeWrapper>

<style>
  .post-author {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .author-avatar,
  .author-avatar-placeholder {
    width: 36px;
    height: 36px;
    border-radius: 50%;
  }

  .author-avatar {
    object-fit: cover;
  }

  .author-avatar-placeholder {
    background: rgba(255, 255, 255, 0.1);
  }

  .author-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .author-name {
    font-size: 13px;
    font-weight: 500;
  }

  .author-handle {
    font-size: 11px;
    color: #666;
  }

  .post-content {
    margin-bottom: 10px;
  }

  .post-content p {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .content-input {
    width: 100%;
    min-height: 60px;
    padding: 8px;
    background: transparent;
    border: 1px solid #333;
    border-radius: 4px;
    color: inherit;
    font-size: 12px;
    resize: none;
    outline: none;
  }

  .post-timestamp {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #666;
    margin-bottom: 8px;
  }

  .post-stats {
    display: flex;
    gap: 16px;
    padding-top: 8px;
    border-top: 1px solid #333;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #666;
  }
</style>
