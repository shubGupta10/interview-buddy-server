import { aiClient } from "./aiClient.js";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';

// Define a structured prompt to generate deep explanations with explicit JSON formatting
// Note the double curly braces {{ }} to escape actual JSON structure examples
const prompt = ChatPromptTemplate.fromTemplate(
  `You are an expert educator who explains concepts in a clear, comprehensive, and structured way.
   
   Given the following question, provide a detailed answer with examples, key points, and actionable insights.
   
   Question: {question}
   
   IMPORTANT: Your response MUST be a valid JSON object with the following structure:
   {{
     "explanation": "detailed explanation here",
     "examples": ["example1", "example2", "example3"],
     "key_points": ["key point 1", "key point 2", "key point 3"],
     "actionable_insights": ["insight 1", "insight 2", "insight 3"]
   }}
   
   Do not include any text, markdown formatting, or other content outside of this JSON structure.
   Do not use backticks, markdown code blocks, or any other wrapper around the JSON.
   Return ONLY the raw JSON object.`
);

const chainPrompt = new LLMChain({
  llm: aiClient,
  prompt
});

export default async function explainQuestionAnsDeeply(question) {
  const result = await chainPrompt.call({ question });
  
  try {
    // First, clean up the response text
    let jsonText = result.text.trim();
    
    // Remove any markdown code blocks if present
    if (jsonText.includes("```")) {
      jsonText = jsonText.replace(/```json|```/g, "").trim();
    }
    
    // Sometimes AI models might add explanatory text before or after the JSON
    // Try to extract just the JSON part using regex
    const jsonMatch = jsonText.match(/(\{[\s\S]*\})/);
    if (jsonMatch && jsonMatch[0]) {
      jsonText = jsonMatch[0];
    }
    
    // Parse the JSON
    const parsedJson = JSON.parse(jsonText);
    
    // Validate that the required fields are present
    const requiredFields = ["explanation", "examples", "key_points", "actionable_insights"];
    for (const field of requiredFields) {
      if (!parsedJson[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    return parsedJson;
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", error);
    console.error("Raw response:", result.text);
    
    // As a fallback, try to construct a valid JSON from the text
    try {
      const fallbackResponse = {
        explanation: "Could not parse the AI response properly. Here's the raw text: " + result.text,
        examples: [],
        key_points: [],
        actionable_insights: []
      };
      return fallbackResponse;
    } catch (fallbackError) {
      throw new Error("AI response was not valid JSON and fallback failed.");
    }
  }
}