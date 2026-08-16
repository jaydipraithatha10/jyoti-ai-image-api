// Vercel Serverless Function
// Secure AI image generation/editing endpoint for Jyoti AI Marketing.
// Set OPENAI_API_KEY in Vercel Environment Variables.
// Never put the API key in app.js or GitHub.

export default async function handler(req, res) {
  const allowedOrigin = "https://jaydipraithatha10.github.io";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured on the server." });
    }

    const body = req.body || {};
    const imageDataUrl = body.image;
    const product = String(body.product || "Product");
    const weight = String(body.weight || "");
    const price = String(body.price || "");
    const tagline = String(body.tagline || "");
    const occasion = String(body.occasion || "");
    const format = String(body.format || "square");

    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Please upload a product image." });
    }

    const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
    if (!match) return res.status(400).json({ error: "Unsupported image format." });

    const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1];
    const buffer = Buffer.from(match[2], "base64");

    // Keep uploads reasonably small for a static-site workflow.
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(413).json({ error: "Image is too large. Please use an image under 10 MB." });
    }

    const size = format === "square" ? "1024x1024" : "1024x1536";

    const prompt = `
Create a premium food-product marketing creative for Jyoti Gruh Udhyog, Rajkot, India.
Use the uploaded product photo as the primary product and preserve its identity, packaging, colors and shape.
Brand style: luxurious Golden Brown, warm cream, rich chocolate brown, subtle gold accents.
Add elegant embossed/raised-looking typography and premium Indian food-brand styling.
Product: ${product}
Weight: ${weight}
Price: ${price}
Tagline: ${tagline}
Occasion: ${occasion || "Everyday premium product promotion"}
Format: ${format}

IMPORTANT:
- Make the product the hero.
- Keep the design clean, premium and suitable for WhatsApp/Instagram.
- Do not invent a different product or change the packaging.
- Do not invent claims, ingredients, certifications or prices.
- Keep clear space for final branding text.
- Do not rely on generated text for exact price/phone details; the website will overlay those precisely after generation.
`;

    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("image[]", new Blob([buffer], { type: mime }), "product.png");
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("quality", "medium");
    form.append("output_format", "png");

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "OpenAI image generation failed."
      });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ error: "No image was returned by the image API." });
    }

    return res.status(200).json({
      image: `data:image/png;base64,${b64}`,
      format,
      product,
      phone: "9712149344"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error while generating the image." });
  }
}
