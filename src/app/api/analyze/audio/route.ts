import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";

// Allow up to 60s for audio transcription + analysis
export const maxDuration = 60;

const region = process.env.AWS_REGION || "us-east-1";
const bedrockClient = new BedrockRuntimeClient({ region });
const s3Client = new S3Client({ region });
const transcribeClient = new TranscribeClient({ region });

/* ─── Helpers ─── */
function getMediaFormat(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/mp4": "mp4",
    "audio/x-m4a": "mp4",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/webm": "webm",
  };
  return map[mimeType] || "mp3";
}

const ANALYSIS_PROMPT = `You are FakeBuster, an expert cybersecurity AI. You are analyzing a transcript of a phone call or voice message that a user received.

Analyze the transcript for:
- Scam calls: fake bank representatives, fake government officials, fake tech support, fake delivery notifications
- Social engineering: creating urgency ("do it NOW"), threatening consequences ("your account will be closed"), demanding OTPs or PINs
- Extortion or blackmail language
- Impersonation of authority figures (RBI, SBI, Police, IT Department)
- Demands for money transfers, personal information, Aadhaar/PAN numbers, or credentials
- Vishing patterns common in India: KYC update calls, customs package scams, loan approval scams

You MUST respond with ONLY valid JSON (no markdown, no backticks):
{
  "score": <number 0-100>,
  "verdict": "<SAFE or SCAM or SUSPICIOUS>",
  "explanation": "<2-4 sentences. Identify specific manipulation tactics in the call.>",
  "flags": ["<short flag>", "..."]
}`;

/* ─── Route Handler ─── */
export async function POST(req: NextRequest) {
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    return NextResponse.json(
      {
        verdict: "ERROR",
        score: 0,
        explanation:
          "Audio analysis requires Amazon S3 and Transcribe. Please set S3_BUCKET_NAME in your .env.local file and create the bucket in your AWS Console (us-east-1).",
        flags: [],
        transcript: "",
      },
      { status: 500 }
    );
  }

  try {
    // 1 ─ Parse the uploaded audio
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "Audio file is required" },
        { status: 400 }
      );
    }

    // 2 ─ Upload to S3
    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const sanitizedName = audioFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const key = `uploads/${Date.now()}-${sanitizedName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: audioFile.type,
      })
    );

    // 3 ─ Start Amazon Transcribe job
    const jobName = `fakebuster-${Date.now()}`;
    const mediaFormat = getMediaFormat(audioFile.type);

    await transcribeClient.send(
      new StartTranscriptionJobCommand({
        TranscriptionJobName: jobName,
        LanguageCode: "en-US",
        MediaFormat: mediaFormat as "mp3" | "mp4" | "wav" | "flac" | "ogg" | "amr" | "webm",
        Media: {
          MediaFileUri: `s3://${bucket}/${key}`,
        },
      })
    );

    // 4 ─ Poll for transcription completion (max ~60 seconds)
    let transcript = "";
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const jobResult = await transcribeClient.send(
        new GetTranscriptionJobCommand({
          TranscriptionJobName: jobName,
        })
      );

      const status = jobResult.TranscriptionJob?.TranscriptionJobStatus;

      if (status === "COMPLETED") {
        const uri =
          jobResult.TranscriptionJob?.Transcript?.TranscriptFileUri;
        if (uri) {
          const res = await fetch(uri);
          const data = await res.json();
          transcript =
            data.results?.transcripts?.[0]?.transcript || "";
        }
        break;
      } else if (status === "FAILED") {
        throw new Error(
          `Transcription failed: ${jobResult.TranscriptionJob?.FailureReason || "Unknown error"}`
        );
      }
      // IN_PROGRESS or QUEUED → keep polling
    }

    if (!transcript) {
      throw new Error(
        "Transcription timed out after 60 seconds. Try a shorter audio clip (under 60 seconds works best)."
      );
    }

    // 5 ─ Analyze transcript with Bedrock
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 600,
      temperature: 0.1,
      system: ANALYSIS_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this call/voice message transcript for scam indicators:\n\n"${transcript.slice(0, 4000)}"`,
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

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(
      new TextDecoder().decode(response.body)
    );
    const resultText = responseBody.content[0].text;

    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI response format");

    const analysis = JSON.parse(jsonMatch[0]);

    // 6 ─ Return combined result (transcript + analysis)
    return NextResponse.json({
      ...analysis,
      transcript,
    });
  } catch (error: unknown) {
    console.error("Audio analysis error:", error);

    const err = error as { name?: string; message?: string };
    let message = "Audio analysis failed.";

    if (err.name === "NoSuchBucket") {
      message = `S3 bucket "${bucket}" does not exist. Create it in AWS Console → S3 → Create Bucket (region: ${region}).`;
    } else if (err.name === "AccessDeniedException") {
      message =
        "AWS access denied. Your IAM user needs permissions for S3, Transcribe, and Bedrock.";
    } else if (err.message?.includes("credentials")) {
      message =
        "AWS credentials not configured. Add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env.local";
    } else if (err.message) {
      message = err.message;
    }

    return NextResponse.json(
      {
        verdict: "ERROR",
        score: 0,
        explanation: message,
        flags: [],
        transcript: "",
      },
      { status: 500 }
    );
  }
}
