import { aiClient } from "./aiClient.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "langchain/chains";

const prompt = ChatPromptTemplate.fromTemplate(`
  You are an expert technical interviewer specializing in {language}.  
  Generate {num_questions} **high-quality, technically accurate** interview questions **with detailed and well-structured answers**.  

  **Guidelines:**  
  - Ensure questions are appropriate for the **{round} interview round**.  
  - The difficulty level is **{difficulty}** (easy, medium, or hard).  
  - Each answer must be **factual**, **in-depth**, and **free from inaccuracies**.  
  - Provide **detailed explanations**, **best practices**, and **real-world examples**.  
  - Do not generate incorrect or vague questions.  
  - **Strictly return only a valid JSON array**. Do NOT include markdown, explanations, or any other text.  

  **JSON Format:**  
  [
    {{
      "question": "What is closure in JavaScript?",
      "answer": "A closure is a function that retains access to its lexical scope even when executed outside that scope.\\n\\n### **How Closures Work**:\\nClosures allow inner functions to access variables of their outer function even after the outer function has finished execution. This makes them useful for maintaining private variables.\\n\\n### **Example**:\\n\\nfunction outer() {{\\n  let count = 0;\\n  return function inner() {{\\n    count++;\\n    console.log(count);\\n  }};\\n}}\\nconst increment = outer();\\nincrement(); // Output: 1\\nincrement(); // Output: 2\\n\\n### **Use Cases**:\\n- Data encapsulation (private variables)\\n- Maintaining state in event handlers\\n- Memoization and performance optimization",
      "difficulty": "{difficulty}"
    }},
    {{
      "question": "Explain event delegation in JavaScript.",
      "answer": "Event delegation is a technique where a single event listener is added to a parent element to handle events for its child elements. This improves performance by reducing the number of event listeners.\\n\\n### **How It Works**:\\nInstead of adding multiple event listeners to individual child elements, you attach a single listener to the parent. The event bubbles up, and the parent checks if the event originated from a specific child element.\\n\\n### **Example**:\\n\\ndocument.getElementById('parent').addEventListener('click', function(event) {{\\n  if (event.target.matches('button')) {{\\n    console.log('Button clicked:', event.target.textContent);\\n  }}\\n}});\\n\\n### **Advantages**:\\n- Efficient memory usage\\n- Works on dynamically added elements\\n- Simplifies event management",
      "difficulty": "{difficulty}"
    }}
  ]
`);




const chainPrompt = new LLMChain({
  llm: aiClient,
  prompt
});

export default async function generateInterviewQA(roundName, difficulty, language, num_questions = 25) {
  const result = await chainPrompt.call({
    round: roundName,
    difficulty,
    language,
    num_questions
  });

  try {
    // Ensure the response is valid JSON
    const jsonText = result.text.trim();

    // Handle cases where AI adds markdown (```json ... ```)
    if (jsonText.startsWith("```json")) {
      const cleanedText = jsonText.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanedText);
    }

    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Failed to parse AI response as JSON:", result.text);
    throw new Error("AI response was not valid JSON.");
  }
}
