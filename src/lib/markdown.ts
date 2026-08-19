import { marked } from "marked";

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "em", "strong", "del", "code", "pre", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "input", "span", "div",
]);

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "colspan", "rowspan", "start", "type", "checked", "disabled",
]);

function safeUrl(value: string): boolean {
  const url = value.trim().toLowerCase();
  return (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("mailto:") ||
    url.startsWith("#") ||
    url.startsWith("/")
  );
}

/** Strips anything that could execute; notes are the user's own, but paste happens. */
function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const bad =
        !ALLOWED_ATTRS.has(name) ||
        ((name === "href" || name === "src") && !safeUrl(attr.value));
      if (bad) el.removeAttribute(attr.name);
    }
    if (tag === "a") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noreferrer noopener");
    }
    if (tag === "input") el.setAttribute("disabled", "");
  }

  return doc.body.innerHTML;
}

/** Markdown → sanitized HTML. Browser only (returns "" during SSR). */
export function renderMarkdown(source: string): string {
  if (typeof window === "undefined") return "";
  const html = marked.parse(source, { async: false, gfm: true, breaks: false }) as string;
  return sanitize(html);
}
