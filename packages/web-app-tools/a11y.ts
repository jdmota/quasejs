// Inspired in https://github.com/mefechoel/svelte-navigator

export {};

/*
<div
  role="status"
  aria-atomic="true"
  aria-live="polite"
  {...createInlineStyle(visuallyHiddenStyle)}
>
  {$announcementText}
</div>
*/

export const visuallyHiddenStyle =
  "position:fixed;" +
  "top:-1px;" +
  "left:0;" +
  "width:1px;" +
  "height:1px;" +
  "padding:0;" +
  "overflow:hidden;" +
  "clip:rect(0,0,0,0);" +
  "white-space:nowrap;" +
  "border:0;";
