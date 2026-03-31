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
  class="w-full px-1.5 py-0.5 bg-[#161b22] border border-[#30363d] rounded text-[#c9d1d9] text-[11px] font-mono text-right outline-none focus:border-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none {className}"
  {value}
  {min}
  {max}
  {step}
  {disabled}
  {placeholder}
  oninput={handleInput}
/>
