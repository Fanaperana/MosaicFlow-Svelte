// Built-in colour themes. Plugins add more with api.registerThemes().

import { themeRegistry } from '$lib/kernel/registries/contribution-registry';

type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  text2: string;
  text3: string;
  line: string; // rgb triplet for borders and hover tints
  pattern: string;
};

function variables(p: Palette, strength = 1): Record<string, string> {
  const a = (alpha: number) => `rgba(${p.line}, ${Math.min(1, alpha * strength)})`;
  return {
    '--mf-bg': p.bg,
    '--mf-surface': p.surface,
    '--mf-surface-2': p.surface2,
    '--mf-text': p.text,
    '--mf-text-2': p.text2,
    '--mf-text-3': p.text3,
    '--mf-border': a(0.07),
    '--mf-border-strong': a(0.12),
    '--mf-hover': a(0.055),
    '--mf-active': a(0.09),
    '--mf-canvas-pattern': p.pattern,
  };
}

export function registerCoreThemes() {
  const themes: { id: string; name: string; description: string; variables: Record<string, string> }[] = [
    { id: 'core.default', name: 'MosaicFlow', description: 'The default dark theme', variables: {} },
    {
      id: 'core.midnight',
      name: 'Midnight',
      description: 'Deep blue',
      variables: variables({ bg: '#0a0e1a', surface: '#0f1424', surface2: '#151b2e', text: '#e6e9f2', text2: '#9aa3b8', text3: '#636b80', line: '140, 160, 255', pattern: '#232a40' }),
    },
    {
      id: 'core.graphite',
      name: 'Graphite',
      description: 'Neutral grey, no tint',
      variables: variables({ bg: '#161616', surface: '#1c1c1c', surface2: '#232323', text: '#ececec', text2: '#a8a8a8', text3: '#707070', line: '255, 255, 255', pattern: '#333333' }),
    },
    {
      id: 'core.nord',
      name: 'Nord',
      description: 'Arctic blue-grey',
      variables: variables({ bg: '#2e3440', surface: '#3b4252', surface2: '#434c5e', text: '#eceff4', text2: '#d8dee9', text3: '#8f9bb3', line: '236, 239, 244', pattern: '#4c566a' }, 1.2),
    },
    {
      id: 'core.solarized',
      name: 'Solarized dark',
      description: 'Low-contrast teal',
      variables: variables({ bg: '#002b36', surface: '#073642', surface2: '#0b3f4c', text: '#eee8d5', text2: '#93a1a1', text3: '#657b83', line: '147, 161, 161', pattern: '#0e4a58' }, 1.3),
    },
    {
      id: 'core.contrast',
      name: 'High contrast',
      description: 'Black background, brighter text and borders',
      variables: variables({ bg: '#000000', surface: '#0a0a0a', surface2: '#141414', text: '#ffffff', text2: '#d6d6d6', text3: '#a3a3a3', line: '255, 255, 255', pattern: '#444444' }, 3),
    },
  ];
  for (const theme of themes) themeRegistry.register({ ...theme, pluginId: 'core' });
}
