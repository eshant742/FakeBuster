import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

const SYSTEM_PROMPT = `You are FakeBuster, an elite cybersecurity and scam-detection AI. Your job is to analyze text content (SMS, social media messages, emails, WhatsApp forwards, URLs) and determine if they are scams, phishing attempts, or safe.

You MUST respond with ONLY valid JSON in this exact format (no markdown, no backticks, no extra text):
{
  "score": <number 0-100, where 0 is completely safe and 100 is extremely dangerous>,
  "verdict": "<SAFE or SCAM or SUSPICIOUS>",
  "explanation": "<2-4 sentence professional analysis. Identify specific manipulation tactics like fake urgency, authority impersonation, phishing URLs, psychological pressure, or data harvesting. If safe, explain why it appears legitimate.>",
  "flags": ["<short red flag 1>", "<short red flag 2>"]
}

Scoring guide:
- 0-30 (SAFE): Normal conversation, legitimate businesses, no manipulation
- 31-60 (SUSPICIOUS): Some concerning elements but not definitively a scam
- 61-100 (SCAM): Clear phishing, social engineering, fraud, or manipulation

Common Indian scam patterns to watch for: fake KYC messages, UPI fraud, lottery/prize scams, fake job offers with registration fees, impersonation of banks (SBI, HDFC, etc.), government impersonation (IT dept, customs), and WhatsApp forward chains with misinformation.`;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Text is required" },
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
              type: "text",
              text: `Analyze this content for scams and threats:\n\n${text.slice(0, 4000)}`,
            },
          ],
        },
      ],
    };

    const command = new InvokeModelCommand({
      modelId: "anthropic.claude-3-haiku-20240307-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const resultText = responseBody.content[0].text;

    // Parse JSON from the response
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI model");
    }

    const finalData = JSON.parse(jsonMatch[0]);

    // Validate response structure
    if (
      typeof finalData.score !== "number" ||
      !finalData.verdict ||
      !finalData.explanation
    ) {
      throw new Error("Incomplete response from AI model");
    }

    return NextResponse.json(finalData);
  } catch (error: unknown) {
    console.error("Text analysis error:", error);

    const err = error as { name?: string; message?: string };
    let message = "Analysis failed. Check AWS Bedrock configuration.";

    if (err.name === "AccessDeniedException") {
      message =
        "AWS Bedrock access denied. Go to AWS Console → Amazon Bedrock → Model Access → Enable 'Claude 3 Haiku' in us-east-1.";
    } else if (
      err.name === "CredentialsProviderError" ||
      err.message?.includes("credentials") ||
      err.message?.includes("Could not load")
    ) {
      message =
        "AWS credentials not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env.local file.";
    }

    return NextResponse.json(
      { verdict: "ERROR", score: 0, explanation: message, flags: [] },
      { status: 500 }
    );
  }
}
