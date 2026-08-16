import OpenAI from "openai";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, status, data) {
  cors(res);
  return res.status(status).json(data);
}

function body(req) {
  if (!req.body) return {};

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

async function compressWebP(buffer) {
  let best = null;

  for (let quality = 80; quality >= 20; quality -= 5) {

    const output = await sharp(buffer)
      .resize(1024, 1024, {
        fit: "cover"
      })
      .webp({
        quality,
        effort: 6
      })
      .toBuffer();

    const kb = output.length / 1024;

    if (
      !best ||
      Math.abs(kb - 45) <
      Math.abs(best.kb - 45)
    ) {
      best = {
        output,
        kb,
        quality
      };
    }

    if (kb >= 40 && kb <= 50) {
      break;
    }
  }

  return best;
}

export default async function handler(req, res) {

  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return json(res, 405, {
      success: false,
      error: "POST required"
    });
  }

  try {

    if (!process.env.OPENAI_API_KEY) {
      return json(res, 500, {
        success: false,
        error: "OPENAI_API_KEY missing"
      });
    }

    const data = body(req);

    const productName =
      data.productName || "Masala Khakhra";

    const weight =
      data.weight || "500 gm";

    const price =
      data.price || "₹160";

    const occasion =
      data.occasion || "";

    const tagline =
      data.tagline ||
      "Crispy • Fresh • Homemade Taste";

    const prompt = `

Create a premium Indian food marketing poster.

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

STYLE:

Premium Gujarati Indian food brand.

Golden brown.
Deep chocolate brown.
Cream background.
Luxury food photography.
Elegant gold accents.
Premium embossed typography.
Clean commercial advertisement.
Professional social media design.
Warm studio lighting.
Realistic food presentation.

IMPORTANT:

Do not invent another brand.
Do not invent another phone number.
Do not invent another price.
Do not add watermark.
Do not add unrelated products.

Make the product name prominent.

Create a beautiful square Instagram advertisement.

Final image:
1024 x 1024 pixels.

`;

    console.log("Starting OpenAI image generation...");

    const result = await client.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
      output_format: "webp",
      output_compression: 80
    });

    console.log("OpenAI response received");

    const image = result?.data?.[0];

    if (!image) {
      throw new Error(
        "OpenAI returned no image"
      );
    }

    let buffer;

    if (image.b64_json) {

      buffer = Buffer.from(
        image.b64_json,
        "base64"
      );

    } else if (image.url) {

      const r = await fetch(image.url);

      if (!r.ok) {
        throw new Error(
          "Generated image download failed"
        );
      }

      buffer = Buffer.from(
        await r.arrayBuffer()
      );

    } else {

      throw new Error(
        "No image data returned"
      );
    }

    const optimized =
      await compressWebP(buffer);

    const base64 =
      optimized.output.toString("base64");

    console.log(
      "Final image:",
      optimized.kb,
      "KB"
    );

    return json(res, 200, {

      success: true,

      width: 1024,

      height: 1024,

      format: "webp",

      size_kb:
        Math.round(optimized.kb),

      quality:
        optimized.quality,

      image_url:
        "data:image/webp;base64," +
        base64

    });

  } catch (error) {

    console.error(
      "GENERATE ERROR:",
      error
    );

    return json(res, 500, {

      success: false,

      error:
        error?.message ||
        "Generation failed"

    });
  }
}