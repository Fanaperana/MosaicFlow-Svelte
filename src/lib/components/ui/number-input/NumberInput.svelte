<script lang="ts">
  interface Props {
    value: number;
    onchange?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    placeholder?: string;
    class?: string;
  }

  let {
    value = $bindable(0),
    onchange,
    min,
    max,
    step = 1,
    disabled = false,
    placeholder,
    class: className = ''
  }: Props = $props();

  function handleInput(e: Event) {
    const newValue = parseInt((e.target as HTMLInputElement).value) || 0;
    value = newValue;
    onchange?.(newValue);
  }
</script>

<input
  type="number"
  class="number-input {className}"
  {value}
  {min}
  {max}
  {step}
  {disabled}
  {placeholder}
  oninput={handleInput}
/>

<style>
  .number-input {
    width: 100%;
    padding: 6px 8px;
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 11px;
    font-family: 'Space Mono', monospace;
    outline: none;
    text-align: right;
  }

  .number-input:focus {
    border-color: #58a6ff;
  }

  .number-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Hide spinner arrows */
  .number-input::-webkit-outer-spin-button,
  .number-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .number-input[type=number] {
    -moz-appearance: textfield;
  }
</style>
