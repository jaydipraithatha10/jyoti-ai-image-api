import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}

export default async function handler(req, res) {
  setCors(res);

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
        error: "OPENAI_API_KEY is missing"
      });
    }

    let data = req.body;

    if (typeof data === "string") {
      data = JSON.parse(data);
    }

    data = data || {};

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
Create ONE premium Indian food advertising poster.

BRAND:
JYOTI GRUH UDHYOG

LOCATION:
RAJKOT

PHONE:
9712149344

PRODUCT:
${productName}

PACK SIZE:
${weight}

PRICE:
${price}

OCCASION:
${occasion}

TAGLINE:
${tagline}

STYLE:
Premium Gujarati Indian food brand.
Golden brown.
Deep chocolate brown.
Cream background.
Luxury Indian food photography.
Warm studio lighting.
Elegant gold accents.
Premium embossed typography.
Clean commercial advertising layout.
Professional social media advertisement.

IMPORTANT:
Use the exact product information supplied above.
Do not invent another brand.
Do not invent another phone number.
Do not invent another price.
Do not add unrelated products.
Do not add watermark.

Create a beautiful square 1024 x 1024 advertising poster.
`;

    console.log("JYOTI: Calling OpenAI");

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt,
      size: "1024x1024"
    });

    console.log("JYOTI: OpenAI response received");

    if (
      !result ||
      !result.data ||
      !result.data.length
    ) {
      throw new Error(
        "OpenAI returned no image"
      );
    }

    const image = result.data[0];

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

    throw new Error(
      "OpenAI returned image without URL or base64 data"
    );

  } catch (error) {
    console.error(
      "JYOTI GENERATE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        String(error)
    });
  }
}