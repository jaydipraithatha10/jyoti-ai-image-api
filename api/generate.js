import OpenAI from "openai";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

/* =========================
   CORS
========================= */

function setCors(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
}

/* =========================
   JSON RESPONSE
========================= */

function sendJSON(res, status, data) {
  setCors(res);
  res.status(status).json(data);
}

/* =========================
   BODY
========================= */

function getBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  return req.body;
}

/* =========================
   DATA URL
========================= */

function cleanDataUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (!value.startsWith("data:image/")) {
    return null;
  }

  return value;
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

/* =========================
   WEBP OPTIMIZATION
   Target: 40–50 KB
========================= */

async function makeWebP40to50KB(buffer) {

  const qualities = [
    80,
    70,
    60,
    50,
    45,
    40,
    35,
    30,
    25,
    20
  ];

  let best = null;

  for (const quality of qualities) {

    const output = await sharp(buffer)
      .resize(1024, 1024, {
        fit: "cover",
        position: "centre"
      })
      .webp({
        quality,
        effort: 6
      })
      .toBuffer();

    const kb =
      output.length / 1024;

    /*
      Perfect target
      40–50 KB
    */

    if (kb >= 40 && kb <= 50) {
      return {
        buffer: output,
        quality,
        sizeKB: Math.round(kb)
      };
    }

    /*
      Keep closest result
    */

    if (!best) {
      best = {
        buffer: output,
        quality,
        sizeKB: kb
      };
    } else {

      const currentDistance =
        Math.abs(kb - 45);

      const bestDistance =
        Math.abs(best.sizeKB - 45);

      if (currentDistance < bestDistance) {
        best = {
          buffer: output,
          quality,
          sizeKB: kb
        };
      }
    }
  }

  return {
    buffer: best.buffer,
    quality: best.quality,
    sizeKB: Math.round(best.sizeKB)
  };
}

/* =========================
   API HANDLER
========================= */

export default async function handler(req, res) {

  setCors(res);

  /*
    Browser preflight
  */

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  /*
    POST only
  */

  if (req.method !== "POST") {
    return sendJSON(res, 405, {
      success: false,
      error: "Only POST requests are allowed."
    });
  }

  try {

    /* =========================
       API KEY CHECK
    ========================= */

    if (!process.env.OPENAI_API_KEY) {

      return sendJSON(res, 500, {
        success: false,
        error:
          "OPENAI_API_KEY is not configured in Vercel."
      });
    }

    /* =========================
       BODY
    ========================= */

    const body = getBody(req);

    const productName =
      body.productName || "Jyoti Special";

    const weight =
      body.weight || "";

    const price =
      body.price || "";

    const occasion =
      body.occasion || "";

    const tagline =
      body.tagline ||
      "Crispy • Fresh • Homemade Taste";

    const customPrompt =
      body.prompt || "";

    /* =========================
       PRODUCT IMAGE
    ========================= */

    const productImage =
      cleanDataUrl(
        body.image ||
        body.imageData ||
        body.productImage
      );

    let inputImageBuffer = null;

    if (productImage) {

      inputImageBuffer =
        getBase64FromDataUrl(
          productImage
        );

      if (
        inputImageBuffer.length >
        MAX_INPUT_BYTES
      ) {

        return sendJSON(res, 413, {
          success: false,
          error:
            "Product image is too large. Please use an image below 10 MB."
        });
      }
    }

    /* =========================
       AI PROMPT
    ========================= */

    const finalPrompt = `

Create a premium Indian food advertising poster.

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

DESIGN STYLE:

Premium Golden Brown food brand.

Use:
- Deep chocolate brown
- Warm golden brown
- Elegant cream
- Subtle gold foil
- Premium studio lighting
- Luxury Indian food advertisement
- Clean composition
- High-end commercial poster
- Realistic food photography
- Embossed premium typography
- Elegant shadows
- Professional packaging advertisement

IMPORTANT:

The supplied product photograph is the reference.

Keep the actual product recognizable.

Do NOT replace the product with an unrelated product.

Do NOT invent another brand.

Do NOT invent another phone number.

Do NOT invent another price.

Do NOT add a watermark.

Make the product the main hero.

Create a premium social-media-ready square advertisement.

Canvas:
1024 x 1024 pixels.

${customPrompt}

`;

    /* =========================
       OPENAI REQUEST
    ========================= */

    const request = {
      model: "gpt-image-1",
      prompt: finalPrompt,
      size: "1024x1024",
      output_format: "webp",
      output_compression: 80
    };

    /*
      If product photo exists,
      send it as image input.
    */

    if (productImage) {

      request.image = [
        {
          image_url: productImage
        }
      ];
    }

    /* =========================
       GENERATE
    ========================= */

    const result =
      await client.images.generate(
        request
      );

    const first =
      result?.data?.[0];

    if (!first) {
      throw new Error(
        "OpenAI did not return an image."
      );
    }

    /* =========================
       GET IMAGE BUFFER
    ========================= */

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

    /* =========================
       FINAL WEBP
    ========================= */

    const optimized =
      await makeWebP40to50KB(
        generatedBuffer
      );

    const base64 =
      optimized.buffer.toString(
        "base64"
      );

    /* =========================
       SUCCESS
    ========================= */

    return sendJSON(res, 200, {

      success: true,

      width: 1024,

      height: 1024,

      format: "webp",

      size_kb:
        optimized.sizeKB,

      quality:
        optimized.quality,

      image_url:
        `data:image/webp;base64,${base64}`

    });

  } catch (error) {

    console.error(
      "Jyoti AI Generate Error:",
      error
    );

    return sendJSON(res, 500, {

      success: false,

      error:
        error?.message ||
        "AI image generation failed."

    });
  }
}