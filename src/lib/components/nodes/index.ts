// Node components index
export { default as NoteNode } from './NoteNode.svelte';
export { default as ImageNode } from './ImageNode.svelte';
export { default as LinkNode } from './LinkNode.svelte';
export { default as CodeNode } from './CodeNode.svelte';
export { default as TimestampNode } from './TimestampNode.svelte';
export { default as PersonNode } from './PersonNode.svelte';
export { default as OrganizationNode } from './OrganizationNode.svelte';
export { default as DomainNode } from './DomainNode.svelte';
export { default as HashNode } from './HashNode.svelte';
export { default as CredentialNode } from './CredentialNode.svelte';
export { default as SocialPostNode } from './SocialPostNode.svelte';
export { default as GroupNode } from './GroupNode.svelte';
export { default as MapNode } from './MapNode.svelte';
export { default as RouterNode } from './RouterNode.svelte';
export { default as LinkListNode } from './LinkListNode.svelte';
export { default as SnapshotNode } from './SnapshotNode.svelte';
export { default as ActionNode } from './ActionNode.svelte';

// Node types map for SvelteFlow
import NoteNode from './NoteNode.svelte';
import ImageNode from './ImageNode.svelte';
import LinkNode from './LinkNode.svelte';
import CodeNode from './CodeNode.svelte';
import TimestampNode from './TimestampNode.svelte';
import PersonNode from './PersonNode.svelte';
import OrganizationNode from './OrganizationNode.svelte';
import DomainNode from './DomainNode.svelte';
import HashNode from './HashNode.svelte';
import CredentialNode from './CredentialNode.svelte';
import SocialPostNode from './SocialPostNode.svelte';
import GroupNode from './GroupNode.svelte';
import MapNode from './MapNode.svelte';
import RouterNode from './RouterNode.svelte';
import LinkListNode from './LinkListNode.svelte';
import SnapshotNode from './SnapshotNode.svelte';
import ActionNode from './ActionNode.svelte';

export const nodeTypes = {
  note: NoteNode,
  image: ImageNode,
  link: LinkNode,
  code: CodeNode,
  timestamp: TimestampNode,
  person: PersonNode,
  organization: OrganizationNode,
  domain: DomainNode,
  hash: HashNode,
  credential: CredentialNode,
  socialPost: SocialPostNode,
  group: GroupNode,
  map: MapNode,
  router: RouterNode,
  linkList: LinkListNode,
  snapshot: SnapshotNode,
  action: ActionNode,
};
