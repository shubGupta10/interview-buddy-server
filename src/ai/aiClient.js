import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from 'dotenv'

dotenv.config();

export const aiClient = new ChatGoogleGenerativeAI({
    model: "gemini-1.5-flash",
    apiKey: process.env.GOOGLE_API_KEY,
    temperature: 0.7,
    maxOutputTokens: 4096
})