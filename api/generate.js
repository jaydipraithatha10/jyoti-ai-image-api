import OpenAI from "openai";
import sharp from "sharp";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}

function send(res, status, data) {
  cors(res);
  return res.status(status).json(data);
}

export default async function handler(req, res) {

  cors(res);

  // Test endpoint
  if (req.method === "GET") {
    return send(res, 200, {
      success: true,
      api: "Jyoti AI Image API",
      status: "working",
      message: "API is online"
    });
  }

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return send(res, 405, {
      success: false,
      error: "POST required"
    });
  }

  try {

    if (!process.env.OPENAI_API_KEY) {
      return send(res, 500, {
        success: false,
        error: "OPENAI_API_KEY missing in Vercel"
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
      data.occasion || "Daily Special";

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

DESIGN:

Premium Golden Brown and Deep Chocolate Brown.
Luxury Indian food brand.
Warm studio lighting.
Premium realistic food presentation.
Elegant gold accents.
Embossed premium typography.
Clean professional commercial advertising.
Premium social media poster.

IMPORTANT:

Keep the exact product name.
Keep the exact pack size.
Keep the exact price.
Keep the exact phone number.
Do not invent another brand.
Do not add another phone number.
Do not add unrelated products.
Do not add watermark.

Create a premium square Instagram advertisement.

FINAL SIZE:
1024 x 1024 pixels.
`;

    console.log("Starting OpenAI...");

    const result =
      await openai.images.generate({
        model: "gpt-image-1",
        prompt: prompt,
        size: "1024x1024",
        output_format: "webp",
        output_compression: 80
      });

    console.log("OpenAI response received");

    const item =
      result?.data?.[0];

    if (!item) {
      throw new Error(
        "OpenAI returned no image"
      );
    }

    let inputBuffer;

    if (item.b64_json) {

      inputBuffer =
        Buffer.from(
          item.b64_json,
          "base64"
        );

    } else if (item.url) {

      const response =
        await fetch(item.url);

      if (!response.ok) {
        throw new Error(
          "Could not download generated image"
        );
      }

      inputBuffer =
        Buffer.from(
          await response.arrayBuffer()
        );

    } else {

      throw new Error(
        "OpenAI image data missing"
      );

    }

    /*
      Convert to exactly 1024 × 1024 WebP
      and try to reach 40–50 KB.
    */

    let finalBuffer = null;
    let finalQuality = 80;

    for (
      let quality = 80;
      quality >= 20;
      quality -= 5
    ) {

      const output =
        await sharp(inputBuffer)
          .resize(1024, 1024, {
            fit: "cover",
            position: "centre"
          })
          .webp({
            quality: quality,
            effort: 6
          })
          .toBuffer();

      const kb =
        output.length / 1024;

      finalBuffer = output;
      finalQuality = quality;

      if (kb <= 50) {
        break;
      }
    }

    const sizeKB =
      Math.round(
        finalBuffer.length / 1024
      );

    return send(res, 200, {

      success: true,

      width: 1024,

      height: 1024,

      format: "webp",

      size_kb: sizeKB,

      quality: finalQuality,

      image_url:
        "data:image/webp;base64," +
        finalBuffer.toString("base64")

    });

  } catch (error) {

    console.error(
      "JYOTI AI ERROR:",
      error
    );

    return send(res, 500, {

      success: false,

      error:
        error?.message ||
        "Image generation failed"

    });

  }
}