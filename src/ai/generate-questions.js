import { aiClient } from "./aiClient.js";
import { ChatPromptTemplate } from "@langchain/core/prompts"; 
import { LLMChain } from "langchain/chains";

const prompt = ChatPromptTemplate.fromTemplate(`
  Generate {num_questions} interview questions based on:
  - **Round:** {round}
  - **Difficulty:** {difficulty}
  - **Programming Language:** {language}
  
  Output only valid JSON array format, no text or markdown formatting:
  [
    {{
      "question": "What is closure in JavaScript?",
      "answer": "A closure is a function that remembers variables from its lexical scope...",
      "difficulty": "{difficulty}"
    }}
  ]
`);

const chainPrompt = new LLMChain({
    llm: aiClient,
    prompt
});

export async function generateInterviewQuestions(roundName, difficulty, language, num_questions = 30) {
    const result = await chainPrompt.call({
        round: roundName,   
        difficulty,
        language,
        num_questions
    });
    return result.text;
}
