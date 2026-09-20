import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const SYSTEM_PROMPT = `You are FakeBuster, an expert cybersecurity AI specialized in visual fraud detection. Analyze images for:

1. Fake payment receipts / UPI screenshots — look for edited amounts, wrong bank branding, inconsistent fonts, Photoshop artifacts, wrong transaction IDs
2. Phishing screenshots — fake login pages, suspicious URLs in address bars, impersonating legitimate brands like Google, Amazon, SBI, Paytm
3. Manipulated documents — forged certificates, edited screenshots, altered text, inconsistent lighting or shadows
4. Suspicious product listings — unrealistic prices, stolen product photos, fake reviews, suspicious seller details
5. Deepfake or AI-generated images — unnatural skin textures, warped backgrounds, inconsistent lighting, text artifacts

You MUST respond with ONLY valid JSON (no markdown, no backticks):
{
  "score": <number 0-100, where 0 is safe and 100 is extremely dangerous>,
  "verdict": "<SAFE or SCAM or SUSPICIOUS>",
  "explanation": "<2-4 sentences. Point out specific visual anomalies, editing artifacts, suspicious elements, or reasons it appears legitimate.>",
  "flags": ["<short flag>", "..."]
}`;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export async function POST(req: NextRequest) {
  try {
    const { image, mediaType } = await req.json();

    if (!image || !mediaType) {
      return NextResponse.json(
        { error: "Image data and media type are required" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(mediaType)) {
      return NextResponse.json(
        {
          error: `Unsupported image type: ${mediaType}. Supported: JPEG, PNG, GIF, WebP`,
        },
        { status: 400 }
      );
    }

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 600,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image,
              },
            },
            {
              type: "text",
              text: "Analyze this image carefully for any signs of scams, fraud, phishing, manipulation, or forgery. Examine every detail — text, URLs, branding, layout, editing artifacts.",
            },
          ],
        },
      ],
    };

    // Claude 3 Haiku supports multimodal (text + image) input
    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const resultText = responseBody.content[0].text;

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI model");
    }

    const finalData = JSON.parse(jsonMatch[0]);

    if (
      typeof finalData.score !== "number" ||
      !finalData.verdict ||
      !finalData.explanation
    ) {
      throw new Error("Incomplete response from AI model");
    }

    return NextResponse.json(finalData);
  } catch (error: unknown) {
    console.error("Image analysis error:", error);

    const err = error as { name?: string; message?: string };
    let message = "Image analysis failed. Check AWS Bedrock configuration.";

    if (err.name === "AccessDeniedException") {
      message =
        "AWS Bedrock access denied. Enable 'Claude 3 Haiku' model access in your AWS Console (us-east-1).";
    } else if (
      err.name === "CredentialsProviderError" ||
      err.message?.includes("credentials")
    ) {
      message =
        "AWS credentials not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env.local";
    } else if (
      err.message?.includes("too large") ||
      err.name === "ValidationException"
    ) {
      message =
        "Image is too large for analysis. Please use an image under 5 MB.";
    }

    return NextResponse.json(
      { verdict: "ERROR", score: 0, explanation: message, flags: [] },
      { status: 500 }
    );
  }
}
