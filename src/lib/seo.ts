/* What a page says to search engines and when its link is shared, worked
   out from the page itself so nobody has to write it — and overridden, part
   by part, by whatever was written in the Studio's Search & sharing. */

/** Text cut to what Google shows (about 155 characters): whole sentences
 *  while they fit, else whole words and an ellipsis. */
export function clip(text: string | undefined, max = 155): string | undefined {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  if (t.length <= max) return t;
  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = '';
  for (const s of sentences) { if ((out + s).trim().length > max) break; out += s; }
  if (out.trim().length >= 60) return out.trim();
  const cut = t.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}

/** the plain text of the first paragraph of Portable Text */
export function firstParagraph(blocks: unknown[] | undefined): string | undefined {
  const b = (blocks as any[] | undefined)?.find((x) => x?._type === 'block' && (!x.style || x.style === 'normal'));
  return b?.children?.map((c: any) => c.text).join('') || undefined;
}
