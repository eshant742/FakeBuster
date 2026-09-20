import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FakeBuster — AI-Powered Scam & Deepfake Detector",
  description:
    "Detect scams, deepfakes, and phishing in text, images, and audio using Amazon Bedrock, S3, and Transcribe. Built for AWS First Commit Hackathon — Bharat Builds Tour 2026.",
  keywords: [
    "scam detector",
    "deepfake detection",
    "phishing detector",
    "AWS Bedrock",
    "Amazon Transcribe",
    "FakeBuster",
    "hackathon",
    "Bharat Builds",
  ],
  authors: [{ name: "Team Gawds" }],
  openGraph: {
    title: "FakeBuster — AI-Powered Scam & Deepfake Detector",
    description:
      "Protect yourself from digital deception with AI-powered analysis of text, images, and audio calls.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#050510" />
      </head>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
