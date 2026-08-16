import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "POST required"
    });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "OPENAI_API_KEY missing in Vercel Environment Variables"
      });
    }

    const data =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

    const productName =
      data.productName || "Masala Khakhra";

    const weight =
      data.weight || "500 gm";

    const price =
      data.price || "₹160";

    const occasion =
      data.occasion || "Daily Product";

    const tagline =
      data.tagline ||
      "Crispy • Fresh • Homemade Taste";

    const prompt = `
Create a premium square Indian food marketing poster.

Brand:
JYOTI GRUH UDHYOG

Location:
RAJKOT

Phone:
9712149344

Product:
${productName}

Pack Size:
${weight}

Price:
${price}

Occasion:
${occasion}

Tagline:
${tagline}

Design:
Premium Golden Brown and Deep Chocolate Brown.
Cream background.
Luxury Indian food brand.
Elegant gold accents.
Premium realistic food presentation.
Warm studio lighting.
Clean commercial advertising layout.
Embossed premium typography.
High-end social media advertisement.

Important:
Do not invent another brand.
Do not invent another phone number.
Do not invent another price.
Do not add unrelated products.
No watermark.

Create a beautiful professional 1024 x 1024 square poster.
`;

    console.log("Starting OpenAI...");

    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024"
    });

    console.log("OpenAI completed");

    const image = result?.data?.[0];

    if (!image) {
      throw new Error("OpenAI returned no image");
    }

    if (image.b64_json) {
      return res.status(200).json({
        success: true,
        width: 1024,
        height: 1024,
        format: "png",
        image_url:
          "data:image/png;base64," +
          image.b64_json
      });
    }

    if (image.url) {
      return res.status(200).json({
        success: true,
        width: 1024,
        height: 1024,
        format: "png",
        image_url: image.url
      });
    }

    throw new Error("No image data returned by OpenAI");

  } catch (error) {
    console.error("GENERATE ERROR:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Image generation failed"
    });
  }
}