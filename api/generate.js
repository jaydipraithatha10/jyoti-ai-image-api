import { createRequire } from "module";
import OpenAI from "openai";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

function sendJSON(res, status, data) {
  res.status(status).json(data);
}

function getBody(req) {
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

function cleanDataUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (value.startsWith("data:image/")) {
    return value;
  }

  return null;
}

function getBase64FromDataUrl(dataUrl) {
  const comma = dataUrl.indexOf(",");

  if (comma === -1) {
    throw new Error("Invalid image data.");
  }

  return Buffer.from(
    dataUrl.slice(comma + 1),
    "base64"
  );
}

async function makeWebP50KB(buffer) {
  let quality = 82;

  let output = await sharp(buffer)
    .resize(1024, 1024, {
      fit: "cover",
      position: "centre"
    })
    .webp({
      quality,
      effort: 6
    })
    .toBuffer();

  while (output.length > 50 * 1024 && quality > 25) {
    quality -= 7;

    output = await sharp(buffer)
      .resize(1024, 1024, {
        fit: "cover",
        position: "centre"
      })
      .webp({
        quality,
        effort: 6
      })
      .toBuffer();
  }

  return {
    buffer: output,
    quality
  };
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return sendJSON(res, 405, {
      error: "Only POST requests are allowed."
    });
  }

  try {

    const body = getBody(req);

    const prompt =
      body.prompt ||
      "Create a premium Jyoti Gruh Udhyog food marketing poster.";

    const productImage =
      cleanDataUrl(
        body.image ||
        body.imageData ||
        body.productImage
      );

    const productName =
      body.productName ||
      "";

    const weight =
      body.weight ||
      "";

    const price =
      body.price ||
      "";

    const occasion =
      body.occasion ||
      "";

    if (!process.env.OPENAI_API_KEY) {
      return sendJSON(res, 500, {
        error: "OPENAI_API_KEY is not configured."
      });
    }

    let finalPrompt = `
Create ONE premium square advertising poster.

Brand:
JYOTI GRUH UDHYOG
RAJKOT

Contact:
9712149344

Product:
${productName}

Pack size:
${weight}

Price:
${price}

Occasion:
${occasion}

Design direction:

- Premium Golden Brown and Deep Chocolate Brown palette.
- Luxury Indian food brand aesthetic.
- Product must remain the hero.
- Use the supplied product photo as the visual reference.
- Do not replace the actual product with an unrelated product.
- Elegant warm studio lighting.
- Premium realistic food photography.
- Sophisticated composition.
- Clean commercial advertising layout.
- Embossed / raised 3D typography appearance.
- Subtle gold-foil effect.
- Premium Gujarati-friendly typography.
- High-end social media advertisement.
- No watermark.
- No unrelated brands.
- Do not invent another phone number.
- Do not invent another price.
- Do not invent another product.

Important:
The final image must be exactly 1024 x 1024 pixels.

Marketing brief:
${prompt}
`;

    const imageRequest = {
      model: "gpt-image-2",
      prompt: finalPrompt,
      size: "1024x1024",
      output_format: "webp",
      output_compression: 80
    };

    if (productImage) {

      const imageBuffer =
        getBase64FromDataUrl(productImage);

      if (imageBuffer.length > MAX_INPUT_BYTES) {
        return sendJSON(res, 413, {
          error: "Product image is too large."
        });
      }

      imageRequest.image = [
        {
          image: productImage
        }
      ];
    }

    const result =
      await client.images.generate(
        imageRequest
      );

    const first =
      result?.data?.[0];

    if (!first) {
      throw new Error(
        "OpenAI did not return an image."
      );
    }

    let generatedBuffer;

    if (first.b64_json) {

      generatedBuffer =
        Buffer.from(
          first.b64_json,
          "base64"
        );

    } else if (first.url) {

      const response =
        await fetch(first.url);

      if (!response.ok) {
        throw new Error(
          "Unable to download generated image."
        );
      }

      generatedBuffer =
        Buffer.from(
          await response.arrayBuffer()
        );

    } else {

      throw new Error(
        "No image data returned by OpenAI."
      );
    }

    /*
      Final processing:
      Always force 1024x1024 WebP.
      Then compress toward 40–50 KB.
    */

    const optimized =
      await makeWebP50KB(
        generatedBuffer
      );

    const base64 =
      optimized.buffer.toString(
        "base64"
      );

    const finalSizeKB =
      Math.round(
        optimized.buffer.length / 1024
      );

    return sendJSON(res, 200, {

      success: true,

      width: 1024,

      height: 1024,

      format: "webp",

      size_kb: finalSizeKB,

      quality: optimized.quality,

      image_url:
        `data:image/webp;base64,${base64}`

    });

  } catch (error) {

    console.error(
      "Jyoti AI Image Error:",
      error
    );

    return sendJSON(res, 500, {

      success: false,

      error:
        error?.message ||
        "Image generation failed."

    });
  }
}