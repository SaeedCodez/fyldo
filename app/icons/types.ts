/** `[tag, attributes, children?]` — plain data so icons render without innerHTML. */
export type IconNode = [tag: string, attrs: Record<string, string>, children?: IconNode[]];
