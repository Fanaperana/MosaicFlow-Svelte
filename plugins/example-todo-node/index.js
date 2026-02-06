/**
 * Example Community Plugin: Todo Node
 * 
 * This is an example of how to create a community plugin that adds
 * a new node type to MosaicFlow.
 * 
 * In production, this would be compiled/bundled separately and loaded
 * dynamically at runtime.
 */

// This is a simplified example - in a real plugin, you'd use proper
// component imports and bundling

/**
 * Todo Node Component (simplified inline version)
 * 
 * In a real plugin, this would be a proper Svelte component file.
 * For this example, we're creating a simple functional component.
 */
const TodoNodeComponent = {
  // This is a placeholder - real implementation would be a Svelte component
  __proto__: null,
  render: () => {
    console.log('Todo node rendered');
  }
};

/**
 * Plugin activation
 */
export function activate(api) {
  console.log(`[${api.manifest.id}] Activating Todo node plugin...`);
  
  // Register the Todo node type
  api.registerNodeTypes([
    {
      type: 'todo',
      label: 'Todo List',
      description: 'A checklist for tracking tasks',
      category: 'utility',
      iconName: 'CheckSquare',
      component: TodoNodeComponent, // In real plugin, this would be a proper Svelte component
      defaultData: {
        title: 'Todo List',
        items: [],
        showCompleted: true,
      },
      dimensions: {
        minWidth: 200,
        minHeight: 150,
        defaultWidth: 280,
        defaultHeight: 250,
      },
      colors: {
        bg: '#1a2e1a',
        border: '#4a6a4a',
        icon: '✅',
      },
      quickAccess: true,
    },
  ]);
  
  console.log(`[${api.manifest.id}] Todo node type registered`);
}

/**
 * Plugin deactivation
 */
export function deactivate() {
  console.log('[community.example.todo] Deactivating Todo node plugin...');
}

// Default export for module loading
export default { activate, deactivate };
