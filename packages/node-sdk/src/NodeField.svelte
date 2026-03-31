<!--
  NodeField Component
  
  Reusable form field component for nodes.
  Supports input, textarea, and select types.
-->
<script lang="ts">
  interface Props {
    label?: string;
    type?: 'text' | 'email' | 'url' | 'tel' | 'number' | 'date' | 'time' | 'datetime-local' | 'password';
    value?: string | number;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    required?: boolean;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    onchange?: (value: string) => void;
    oninput?: (value: string) => void;
    class?: string;
  }

  let { 
    label,
    type = 'text',
    value = '',
    placeholder,
    disabled,
    readonly: readOnly,
    required,
    min,
    max,
    step,
    onchange,
    oninput,
    class: className = '',
  }: Props = $props();

  function handleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    onchange?.(target.value);
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement;
    oninput?.(target.value);
  }
  
  // Generate unique ID for accessibility
  const fieldId = `field-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="node-field {className}">
  {#if label}
    <label for={fieldId}>{label}</label>
  {/if}
  <input 
    id={fieldId}
    class="nodrag"
    {type}
    value={value ?? ''}
    {placeholder}
    {disabled}
    readonly={readOnly}
    {required}
    {min}
    {max}
    {step}
    onchange={handleChange}
    oninput={handleInput}
  />
</div>
