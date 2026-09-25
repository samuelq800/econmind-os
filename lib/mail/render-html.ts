import sanitizeHtml from "sanitize-html";

// Email markup is untrusted. Parse it as text, before it reaches a browser DOM.
// Keep common table layouts and inline typography, but never CSS resource URLs.
const color = /^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i;
const size = /^(?:auto|0|\d+(?:\.\d+)?(?:px|em|rem|%|pt|vh|vw))(?:\s+(?:auto|0|\d+(?:\.\d+)?(?:px|em|rem|%|pt|vh|vw))){0,3}$/i;
const border = /^(?:none|0|\d+(?:\.\d+)?px(?:\s+(?:solid|dashed|dotted))?(?:\s+(?:#[0-9a-f]{3,8}|[a-z]+))?)$/i;
const imageData = /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/]+={0,2}$/i;

const allowedStyles: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": {
    color: [color], "background-color": [color], background: [color],
    "font-family": [/^[\w\s,'"-]{1,120}$/], "font-size": [size], "font-weight": [/^(?:normal|bold|bolder|lighter|[1-9]00)$/i],
    "font-style": [/^(?:normal|italic|oblique)$/i], "text-decoration": [/^(?:none|underline|line-through|overline)$/i],
    "text-align": [/^(?:left|right|center|justify|start|end)$/i],
    "line-height": [/^(?:normal|\d+(?:\.\d+)?(?:px|em|rem|%|pt)?)$/i],
    "letter-spacing": [size], "vertical-align": [/^(?:top|middle|bottom|baseline|text-top|text-bottom)$/i],
    "white-space": [/^(?:normal|nowrap|pre|pre-wrap|pre-line)$/i],
    display: [/^(?:block|inline|inline-block|table|table-row|table-cell|none)$/i],
    width: [size], height: [size], "min-width": [size], "max-width": [size],
    padding: [size], "padding-top": [size], "padding-right": [size], "padding-bottom": [size], "padding-left": [size],
    margin: [size], "margin-top": [size], "margin-right": [size], "margin-bottom": [size], "margin-left": [size],
    border: [border], "border-top": [border], "border-right": [border], "border-bottom": [border], "border-left": [border],
    "border-color": [color], "border-width": [size], "border-style": [/^(?:none|solid|dashed|dotted)$/i],
    "border-collapse": [/^(?:collapse|separate)$/i], "border-spacing": [size], "border-radius": [size],
  },
};

export function sanitizeEmailHtml(html: string, loadRemoteImages = false): string {
  return sanitizeHtml(html, {
    allowedTags: ["p", "div", "span", "br", "hr", "b", "strong", "i", "em", "u", "s", "strike", "small", "big", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "center", "font", "a", "img"],
    allowedAttributes: {
      "*": ["style", "dir", "align", "width", "height", "bgcolor"],
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      table: ["border", "cellpadding", "cellspacing", "width", "align", "bgcolor", "style"],
      td: ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor", "style"],
      th: ["colspan", "rowspan", "width", "height", "align", "valign", "bgcolor", "style"],
      font: ["color", "size", "face", "style"],
    },
    allowedStyles,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "data"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tag, attrs) => ({ tagName: "a", attribs: { ...attrs, target: "_blank", rel: "noopener noreferrer nofollow" } }),
      img: (_tag, attrs) => {
        const src = attrs.src?.trim() ?? "";
        if (imageData.test(src) || (loadRemoteImages && /^https:\/\//i.test(src))) {
          return { tagName: "img", attribs: { ...attrs, src } };
        }
        return { tagName: "span", attribs: {}, text: attrs.alt || "[Image blocked]" };
      },
    },
    nonTextTags: ["script", "style", "textarea", "noscript", "iframe", "object", "svg", "math"],
    disallowedTagsMode: "discard",
  });
}

export function emailHtmlDocument(html: string, loadRemoteImages = false): string {
  const images = loadRemoteImages ? "data: https:" : "data:";
  const content = sanitizeEmailHtml(html, loadRemoteImages);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src ${images}; font-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-src 'none'; object-src 'none'"><style>html{color-scheme:light}body{margin:16px;background:#fff;color:#1b1b1b;font:14px/1.6 Arial,sans-serif;overflow-wrap:anywhere}table{max-width:100%}img{max-width:100%;height:auto}pre{white-space:pre-wrap}a{color:#1b6655}</style></head><body>${content}</body></html>`;
}
