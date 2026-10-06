// Reader for the pre-markdown node format (nodes/<id>/data/{content,properties.json}).
// Frozen: only used to migrate existing canvases to nodes/<id>.md.

import type { FsAdapter, StoredNode } from '@mosaicflow/vault-core';

export async function readLegacyNode(
  fs: FsAdapter,
  canvasPath: string,
  nodeId: string,
  type: string
): Promise<StoredNode | null> {
  const dataPath = `${canvasPath}/nodes/${nodeId}/data`;
  const propsPath = `${dataPath}/properties.json`;
  if (!(await fs.exists(propsPath))) return null;

  const properties = JSON.parse(await fs.readText(propsPath));
  const contentPath = `${dataPath}/content`;
  const content = (await fs.exists(contentPath)) ? await fs.readText(contentPath) : '';

  const data: Record<string, unknown> = { ...properties.data };
  applyLegacyContent(type, data, content);

  return {
    id: nodeId,
    type,
    position: properties.position,
    width: properties.width,
    height: properties.height,
    zIndex: properties.zIndex,
    parentId: properties.parentId,
    extent: properties.extent,
    expandParent: properties.expandParent,
    data,
  };
}

function applyLegacyContent(type: string, data: Record<string, unknown>, content: string) {
  switch (type) {
    case 'note':
    case 'socialPost':
      data.content = content;
      break;
    case 'code':
      data.code = content;
      break;
    case 'image':
    case 'snapshot':
      if (content.startsWith('asset://') || content.startsWith('http')) {
        data.imageUrl = content;
      } else if (content) {
        data[type === 'image' ? 'imagePath' : 'sourceUrl'] = content;
      }
      break;
    case 'link':
    case 'iframe':
      data.url = content;
      break;
    case 'timestamp':
      if (content) {
        data.customTimestamp = content;
        data.datetime = content;
      }
      break;
    case 'person':
    case 'organization':
    case 'router':
      data.name = content;
      break;
    case 'domain':
      data.domain = content;
      break;
    case 'hash':
      data.hash = content;
      break;
    case 'credential':
      data.username = content;
      break;
    case 'group':
    case 'annotation':
      data.label = content;
      break;
    case 'action':
      data.action = content;
      break;
    case 'map': {
      const [lat, lon] = content.split(',').map(Number);
      data.latitude = Number.isFinite(lat) ? lat : 0;
      data.longitude = Number.isFinite(lon) ? lon : 0;
      break;
    }
    case 'linkList':
      data.links = content
        ? content.split('\n').filter(Boolean).map((line) => {
            const [title, url] = line.split('|');
            return { title: title || '', url: url || '' };
          })
        : [];
      break;
  }
}
