import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an expert infographic designer. Generate a complete, self-contained SVG infographic from the given text.

CRITICAL RULES:
1. Return ONLY valid SVG markup. Start with <svg> and end with </svg>. NO markdown, NO explanation.
2. SVG dimensions: width="800" height="600" viewBox="0 0 800 600"
3. Detect input language. If Hebrew/Arabic, use dir="rtl" and text-anchor="end" for text, and place text right-aligned.
4. Use modern, clean, professional design with:
   - Rounded rectangles with soft shadows
   - A harmonious color palette (blues, teals, warm accents)
   - Clear visual hierarchy: large bold title, medium subtitles, smaller body text
   - Icons represented as simple geometric shapes or emoji characters
   - Connecting lines, arrows, or visual flow between elements
5. Font: Use sans-serif fonts. For Hebrew use 'Segoe UI', 'Arial', sans-serif.
6. Include a background (subtle gradient or solid light color).
7. Make it visually rich: use gradients, rounded corners (rx="12"), subtle drop shadows via <filter>.
8. Text MUST be inside the shapes, properly centered and sized to fit.
9. Use 4-8 content items maximum. Labels should be 1-4 words. Descriptions 1 short sentence.
10. Layout types to choose from based on content:
    - Vertical list with cards (best for sequential items)
    - Grid layout (best for features/categories)  
    - Timeline (best for chronological events)
    - Flowchart (best for processes)
    - Comparison (best for pros/cons)

EXAMPLE SVG STRUCTURE:
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.15"/>
    </filter>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#f0f4f8"/>
      <stop offset="100%" style="stop-color:#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)" rx="0"/>
  <!-- Title -->
  <text x="400" y="50" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#1a365d">Title Here</text>
  <!-- Cards with shadow -->
  <rect x="50" y="80" width="320" height="100" rx="12" fill="white" filter="url(#shadow)"/>
  <rect x="58" y="80" width="6" height="100" rx="3" fill="#3182ce"/>
  <text x="80" y="120" font-family="sans-serif" font-size="18" font-weight="bold" fill="#2d3748">Label</text>
  <text x="80" y="145" font-family="sans-serif" font-size="14" fill="#718096">Description text here</text>
</svg>

Make the infographic BEAUTIFUL and PROFESSIONAL. Use color coding, visual grouping, and clear information hierarchy.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Create a beautiful SVG infographic from this text. Return ONLY the SVG code:\n\n${text}`,
          },
        ],
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add AI credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract SVG from response
    let svg = content.trim();
    
    // Remove markdown code blocks if present
    if (svg.startsWith("```")) {
      svg = svg.replace(/^```(?:svg|xml|html)?\n?/, "").replace(/\n?```$/, "");
    }
    
    // Extract just the SVG tag
    const svgStart = svg.indexOf("<svg");
    const svgEnd = svg.lastIndexOf("</svg>");
    if (svgStart !== -1 && svgEnd !== -1) {
      svg = svg.substring(svgStart, svgEnd + 6);
    }

    if (!svg.includes("<svg")) {
      console.error("No valid SVG in response:", svg.substring(0, 200));
      return new Response(JSON.stringify({ error: "Failed to generate valid SVG" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.info("Generated SVG infographic, length:", svg.length);

    return new Response(JSON.stringify({ svg }), {
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
