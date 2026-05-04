import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
});

export const MAIN_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
export const AUDIO_MODEL = "gemini-2.5-flash";
