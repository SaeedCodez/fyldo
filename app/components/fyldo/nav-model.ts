/** What the Sidebar and the Top Navigation draw: the same items, icons and order in both layouts (design rule 16). */

export interface NavEntry {
  /** Page id. */
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  active: boolean;
}

export interface NavGroup {
  id: string;
  /** Sidebar group label (1–2 words); none for pages outside a group. The Top Navigation draws a divider instead. */
  label?: string;
  items: NavEntry[];
}

/** Utility link (Documentation, Help & support): sidebar footer, or top-right of the Top Navigation. */
export interface UtilityLink {
  label: string;
  href: string;
  icon?: string;
  external: boolean;
}

/** The instance `logo`: an Iconsax icon (24px) or an image URL (24×24). None: the Fyldo mark. */
export type BrandLogo = { icon: string } | { url: string };

export interface Brand {
  /** The instance title ("Fyldo" when the developer gives none). */
  name: string;
  logo?: BrandLogo;
  /** Shown in a Badge ("v1.0"); none when empty. */
  version?: string;
}
