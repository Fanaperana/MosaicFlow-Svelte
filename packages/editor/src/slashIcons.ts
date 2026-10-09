import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Code, Table, Minus, Sigma,
  Workflow, Bold, Italic, Strikethrough, CodeXml, Link, Link2, Rows3, Columns3, AlignLeft,
  AlignCenter, AlignRight, Trash2, WandSparkles,
} from 'lucide-svelte';

// Kept apart from slashCommands.ts so the commands stay free of Svelte components.
export const slashIcons = {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Code, Table, Minus, Sigma,
  Workflow, Bold, Italic, Strikethrough, CodeXml, Link, Link2, Rows3, Columns3, AlignLeft,
  AlignCenter, AlignRight, Trash2, WandSparkles,
};

export type SlashIcon = keyof typeof slashIcons;
