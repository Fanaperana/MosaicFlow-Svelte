<!-- A preset as a square split on the diagonal: text colour top-left, fill bottom-right, framed by the border colour. -->
<script lang="ts">
  let { fill, border, text, size = 22 }: { fill: string; border: string; text: string; size?: number } = $props();
</script>

<span
  class="swatch"
  style:width="{size}px"
  style:height="{size}px"
  style:border-color={border}
  style:background="linear-gradient(to bottom right, {text} 0 50%, {fill} 50% 100%)"
></span>

<style>
  .swatch {
    display: block;
    flex-shrink: 0;
    box-sizing: border-box;
    border: 1.5px solid;
    border-radius: 5px;
  }
</style>