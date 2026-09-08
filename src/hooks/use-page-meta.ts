import { useEffect } from "react";

export interface PageMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
}

type MetaSelector = { attr: "name" | "property"; key: string };

const SELECTORS: Record<keyof Omit<PageMeta, "title">, MetaSelector> = {
  description: { attr: "name", key: "description" },
  ogTitle: { attr: "property", key: "og:title" },
  ogDescription: { attr: "property", key: "og:description" },
};

function readMeta({ attr, key }: MetaSelector): string {
  return document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") ?? "";
}

function writeMeta({ attr, key }: MetaSelector, content: string): void {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

// The values shipped in index.html — restored when a page unmounts so a route
// without its own meta falls back to the site defaults, the way the TanStack
// root route's head() used to.
const DEFAULTS: PageMeta = {
  title: document.title,
  description: readMeta(SELECTORS.description),
  ogTitle: readMeta(SELECTORS.ogTitle),
  ogDescription: readMeta(SELECTORS.ogDescription),
};

function apply(meta: PageMeta): void {
  document.title = meta.title;
  writeMeta(SELECTORS.description, meta.description);
  writeMeta(SELECTORS.ogTitle, meta.ogTitle);
  writeMeta(SELECTORS.ogDescription, meta.ogDescription);
}

/**
 * Sets the document title and the description/Open Graph tags for a page.
 *
 * This is the client-side stand-in for TanStack Start's route `head()`. Crawlers
 * that execute JavaScript will see these; if you later need the tags present in
 * the initial HTML, that needs prerendering rather than a hook.
 */
export function usePageMeta(meta: PageMeta): void {
  const { title, description, ogTitle, ogDescription } = meta;

  useEffect(() => {
    apply({ title, description, ogTitle, ogDescription });
    return () => apply(DEFAULTS);
  }, [title, description, ogTitle, ogDescription]);
}
