import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TemplateId =
  | "stacked"
  | "arrow"
  | "diamond"
  | "puzzle"
  | "radial"
  | "pinwheel"
  | "eight"
  | "pyramid"
  | "funnel"
  | "timeline"
  | "hexagon"
  | "venn"
  | "cycle";

interface ContentItem {
  label: string;
  description: string;
  icon: string;
}

const VALID_TEMPLATE_IDS = new Set<TemplateId>([
  "stacked",
  "arrow",
  "diamond",
  "puzzle",
  "radial",
  "pinwheel",
  "eight",
  "pyramid",
  "funnel",
  "timeline",
  "hexagon",
  "venn",
  "cycle",
]);

const ICONS = ["💡", "🧩", "🚀", "📊", "📌", "🔒", "⚙️", "🌟"];

const PALETTE = [
  ["hsl(222 89% 66%)", "hsl(252 75% 63%)"],
  ["hsl(191 85% 58%)", "hsl(171 72% 45%)"],
  ["hsl(38 95% 60%)", "hsl(24 95% 58%)"],
  ["hsl(335 86% 63%)", "hsl(286 70% 58%)"],
  ["hsl(147 69% 55%)", "hsl(171 75% 44%)"],
  ["hsl(260 75% 68%)", "hsl(215 90% 65%)"],
  ["hsl(198 90% 62%)", "hsl(221 83% 58%)"],
  ["hsl(12 90% 66%)", "hsl(27 95% 60%)"],
] as const;

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function detectRtl(text: string) {
  return /[\u0590-\u05FF\u0600-\u06FF]/.test(text);
}

function cleanLine(line: string) {
  return line.replace(/^[\-•*\d.\)\s]+/, "").trim();
}

function toShortLabel(text: string) {
  return text
    .split(/\s+/)
    .slice(0, 3)
    .join(" ")
    .trim();
}

function normalizeItems(items: ContentItem[]) {
  const filtered = items.filter((i) => i.label.length > 0).slice(0, 8);
  const padded = [...filtered];
  while (padded.length < 4) {
    const seed = padded[padded.length - 1] ?? { label: "שלב", description: "", icon: "✨" };
    padded.push({ ...seed, label: `${seed.label} ${padded.length + 1}`.trim() });
  }
  return padded;
}

function heuristicExtract(text: string): { title: string; items: ContentItem[] } {
  const rawParts = text
    .split(/\n+/)
    .flatMap((line) => line.split(/\s*(?:→|->|;|,)\s*/))
    .map(cleanLine)
    .filter(Boolean);

  const parts = rawParts.length > 0 ? rawParts : [text.trim()];

  const titleSource = parts[0] || "Infographic";
  const title = titleSource.includes(":")
    ? titleSource.split(":")[0].trim()
    : toShortLabel(titleSource) || "Infographic";

  const itemSource = parts.slice(0, 8);
  const items = normalizeItems(
    itemSource.map((part, idx) => ({
      label: toShortLabel(part),
      description: part.length > 54 ? `${part.slice(0, 51)}...` : part,
      icon: ICONS[idx % ICONS.length],
    }))
  );

  return { title, items };
}

function chunkLabel(label: string, maxChars = 16) {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
      continue;
    }
    line = candidate;
  }

  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function gradientDefs() {
  const defs = PALETTE.map(
    ([from, to], idx) => `
    <linearGradient id="grad${idx}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>`
  ).join("\n");

  return `
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="hsl(221 39% 11% / 0.25)" />
    </filter>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="hsl(210 60% 98%)" />
      <stop offset="100%" stop-color="hsl(216 48% 93%)" />
    </linearGradient>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="hsl(222 28% 32%)" />
    </marker>
    ${defs}
  </defs>`;
}

function renderTextBlock(item: ContentItem, x: number, y: number, rtl: boolean) {
  const lines = chunkLabel(escapeXml(item.label));
  const anchor = "middle";
  const directionAttr = rtl ? ' direction="rtl" unicode-bidi="plaintext"' : "";

  return `
    <text x="${x}" y="${y - 4}" text-anchor="${anchor}" font-family="'Segoe UI', Arial, sans-serif" font-size="18" font-weight="700" fill="white"${directionAttr}>${lines[0] || ""}</text>
    ${
      lines[1]
        ? `<text x="${x}" y="${y + 20}" text-anchor="${anchor}" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="700" fill="white"${directionAttr}>${lines[1]}</text>`
        : ""
    }
    <text x="${x}" y="${y - 34}" text-anchor="middle" font-size="24">${item.icon}</text>`;
}

function card(x: number, y: number, w: number, h: number, fillId: number, item: ContentItem, rtl: boolean, sketch = false) {
  return `
    <g filter="url(#shadow)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="url(#grad${fillId % PALETTE.length})" />
      ${
        sketch
          ? `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="16" fill="none" stroke="hsl(0 0% 100% / 0.38)" stroke-width="1.2" stroke-dasharray="3 2" />`
          : ""
      }
      ${renderTextBlock(item, x + w / 2, y + h / 2 + 10, rtl)}
    </g>`;
}

function toHexagonPath(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(" ");
  return pts;
}

function renderTemplate(templateId: TemplateId, title: string, items: ContentItem[], rtl: boolean) {
  const n = items.length;
  const t = escapeXml(title);
  const directionAttr = rtl ? ' dir="rtl"' : "";

  let body = "";

  switch (templateId) {
    case "stacked": {
      const h = 72;
      const gap = 12;
      const total = n * h + (n - 1) * gap;
      const startY = Math.max(110, (560 - total) / 2 + 40);
      body = items
        .map((item, i) => card(130, startY + i * (h + gap), 540, h, i, item, rtl))
        .join("\n");
      break;
    }

    case "arrow": {
      const cols = Math.min(n, 6);
      const w = 105;
      const h = 92;
      const gap = 16;
      const startX = (800 - (cols * w + (cols - 1) * gap)) / 2;
      const y = 250;
      body = items.slice(0, cols).map((item, i) => {
        const x = startX + i * (w + gap);
        return `
          <g filter="url(#shadow)">
            <path d="M${x} ${y} H${x + w - 24} L${x + w} ${y + h / 2} L${x + w - 24} ${y + h} H${x} L${x + 18} ${y + h / 2} Z" fill="url(#grad${i % PALETTE.length})" />
            ${renderTextBlock(item, x + w / 2 - 4, y + h / 2 + 10, rtl)}
          </g>
        `;
      }).join("\n");
      break;
    }

    case "diamond": {
      const center = items[0];
      const around = items.slice(1, 5);
      const positions = [
        [400, 155],
        [620, 300],
        [400, 445],
        [180, 300],
      ];
      body = `
        <g filter="url(#shadow)">
          <polygon points="400,230 500,300 400,370 300,300" fill="url(#grad0)" />
          ${renderTextBlock(center, 400, 315, rtl)}
        </g>
        ${around
          .map((item, i) => {
            const [cx, cy] = positions[i];
            return `<g>
              <line x1="400" y1="300" x2="${cx}" y2="${cy}" stroke="hsl(222 20% 42% / 0.45)" stroke-width="2" stroke-dasharray="5 4" />
              ${card(cx - 90, cy - 44, 180, 88, i + 1, item, rtl, true)}
            </g>`;
          })
          .join("\n")}
      `;
      break;
    }

    case "puzzle": {
      const cols = 2;
      const rows = Math.ceil(n / cols);
      const w = 290;
      const h = 95;
      const gapX = 30;
      const gapY = 18;
      const startX = 95;
      const startY = Math.max(110, 165 - ((rows - 2) * 30));

      body = items.map((item, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        const x = startX + col * (w + gapX);
        const y = startY + row * (h + gapY);
        const tabX = col === 0 ? x + w : x;
        const tabDir = col === 0 ? 1 : -1;

        return `
          <g>
            ${card(x, y, w, h, i, item, rtl, true)}
            <circle cx="${tabX}" cy="${y + h / 2}" r="12" fill="url(#grad${i % PALETTE.length})" />
            <circle cx="${tabX + 16 * tabDir}" cy="${y + h / 2}" r="10" fill="hsl(210 60% 98%)" />
          </g>
        `;
      }).join("\n");
      break;
    }

    case "radial": {
      const center = items[0];
      const outer = items.slice(1);
      const radius = 190;
      body = `
        ${card(300, 240, 200, 120, 0, center, rtl)}
        ${outer
          .map((item, i) => {
            const angle = (Math.PI * 2 * i) / outer.length - Math.PI / 2;
            const cx = 400 + radius * Math.cos(angle);
            const cy = 300 + radius * Math.sin(angle);
            return `
              <line x1="400" y1="300" x2="${cx}" y2="${cy}" stroke="hsl(222 18% 45% / 0.38)" stroke-width="2" stroke-dasharray="4 4" />
              ${card(cx - 80, cy - 42, 160, 84, i + 1, item, rtl)}
            `;
          })
          .join("\n")}
      `;
      break;
    }

    case "pinwheel": {
      const radius = 150;
      body = items.map((item, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const cx = 400 + radius * Math.cos(angle);
        const cy = 300 + radius * Math.sin(angle);
        const rotate = (angle * 180) / Math.PI + 90;
        return `
          <g transform="translate(${cx - 70},${cy - 35}) rotate(${rotate},70,35)">
            ${card(0, 0, 140, 70, i, item, rtl, true)}
          </g>
          <line x1="400" y1="300" x2="${cx}" y2="${cy}" stroke="hsl(224 23% 34% / 0.35)" stroke-width="1.8" />
        `;
      }).join("\n");
      break;
    }

    case "eight": {
      const left = items.slice(0, Math.ceil(n / 2));
      const right = items.slice(Math.ceil(n / 2));
      body = `
        <path d="M180 300 C180 200, 310 200, 310 300 C310 400, 180 400, 180 300 Z" fill="none" stroke="hsl(220 30% 40% / 0.32)" stroke-width="6" />
        <path d="M490 300 C490 200, 620 200, 620 300 C620 400, 490 400, 490 300 Z" fill="none" stroke="hsl(220 30% 40% / 0.32)" stroke-width="6" />
        ${left.map((item, i) => card(95 + i * 34, 250 + i * 45, 170, 78, i, item, rtl)).join("\n")}
        ${right.map((item, i) => card(470 - i * 24, 250 + i * 45, 170, 78, i + left.length, item, rtl)).join("\n")}
      `;
      break;
    }

    case "pyramid": {
      const levels = Math.min(n, 5);
      body = items.slice(0, levels).map((item, i) => {
        const widthTop = 150 + (levels - i - 1) * 80;
        const widthBottom = widthTop + 70;
        const y = 140 + i * 84;
        const xTop = 400 - widthTop / 2;
        const xBottom = 400 - widthBottom / 2;
        const path = `M${xTop} ${y} H${xTop + widthTop} L${xBottom + widthBottom} ${y + 74} H${xBottom} Z`;
        return `
          <g filter="url(#shadow)">
            <path d="${path}" fill="url(#grad${i})" />
            ${renderTextBlock(item, 400, y + 48, rtl)}
          </g>
        `;
      }).join("\n");
      break;
    }

    case "funnel": {
      const levels = Math.min(n, 5);
      body = items.slice(0, levels).map((item, i) => {
        const topW = 640 - i * 98;
        const botW = topW - 82;
        const y = 140 + i * 86;
        const xTop = 400 - topW / 2;
        const xBot = 400 - botW / 2;
        const path = `M${xTop} ${y} H${xTop + topW} L${xBot + botW} ${y + 72} H${xBot} Z`;
        return `
          <g filter="url(#shadow)">
            <path d="${path}" fill="url(#grad${i})" />
            ${renderTextBlock(item, 400, y + 45, rtl)}
          </g>
        `;
      }).join("\n");
      break;
    }

    case "timeline": {
      const spacing = 620 / Math.max(1, n - 1);
      body = `
        <line x1="90" y1="300" x2="710" y2="300" stroke="hsl(221 24% 41% / 0.45)" stroke-width="4" stroke-linecap="round" />
        ${items
          .map((item, i) => {
            const x = 90 + i * spacing;
            const top = i % 2 === 0;
            const yCard = top ? 150 : 330;
            return `
              <circle cx="${x}" cy="300" r="9" fill="url(#grad${i})" />
              <line x1="${x}" y1="300" x2="${x}" y2="${top ? yCard + 86 : yCard}" stroke="hsl(221 24% 41% / 0.35)" stroke-width="2" />
              ${card(x - 75, yCard, 150, 86, i, item, rtl)}
            `;
          })
          .join("\n")}
      `;
      break;
    }

    case "hexagon": {
      const coords = [
        [290, 210], [400, 210], [510, 210],
        [345, 330], [455, 330], [400, 450],
      ];
      body = items.slice(0, Math.min(items.length, coords.length)).map((item, i) => {
        const [cx, cy] = coords[i];
        return `
          <g filter="url(#shadow)">
            <polygon points="${toHexagonPath(cx, cy, 62)}" fill="url(#grad${i})" />
            ${renderTextBlock(item, cx, cy + 8, rtl)}
          </g>
        `;
      }).join("\n");
      break;
    }

    case "venn": {
      const circles = [
        { cx: 310, cy: 310, fill: "hsl(222 89% 66% / 0.55)" },
        { cx: 430, cy: 310, fill: "hsl(161 73% 46% / 0.55)" },
        { cx: 370, cy: 230, fill: "hsl(24 95% 58% / 0.55)" },
      ];
      const vennItems = items.slice(0, 3);
      body = `
        ${circles
          .map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="135" fill="${c.fill}" stroke="hsl(220 30% 30% / 0.22)" stroke-width="2" />`)
          .join("\n")}
        ${vennItems.map((item, i) => renderTextBlock(item, circles[i].cx, circles[i].cy + 10, rtl)).join("\n")}
        ${
          items[3]
            ? `<text x="370" y="318" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="16" font-weight="700" fill="hsl(220 38% 22%)">${escapeXml(items[3].label)}</text>`
            : ""
        }
      `;
      break;
    }

    case "cycle": {
      const r = 175;
      body = items.map((item, i) => {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const nx = 400 + r * Math.cos(a);
        const ny = 300 + r * Math.sin(a);
        const na = (Math.PI * 2 * ((i + 1) % n)) / n - Math.PI / 2;
        const tx = 400 + r * Math.cos(na);
        const ty = 300 + r * Math.sin(na);
        return `
          <line x1="${nx}" y1="${ny}" x2="${tx}" y2="${ty}" stroke="hsl(223 24% 35% / 0.42)" stroke-width="2" marker-end="url(#arrow)" />
          ${card(nx - 75, ny - 42, 150, 84, i, item, rtl, true)}
        `;
      }).join("\n");
      break;
    }

    default: {
      body = items.map((item, i) => card(120, 130 + i * 90, 560, 78, i, item, rtl)).join("\n");
      break;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"${directionAttr}>
  ${gradientDefs()}
  <rect width="800" height="600" fill="url(#bg)" />
  <text x="400" y="56" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="34" font-weight="800" fill="hsl(222 47% 20%)">${t}</text>
  ${body}
</svg>`;
}

function normalizeTemplateId(input: unknown): TemplateId {
  if (typeof input === "string" && VALID_TEMPLATE_IDS.has(input as TemplateId)) {
    return input as TemplateId;
  }
  return "stacked";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, templateId } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = normalizeTemplateId(templateId);
    const { title, items } = heuristicExtract(text);
    const rtl = detectRtl(text);

    const svg = renderTemplate(template, title, items, rtl);

    return new Response(JSON.stringify({ svg, templateUsed: template }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Function error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
