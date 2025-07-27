/**
 * Demo Sampling Data
 *
 * Sample LLM response simulation for testing and demonstration purposes.
 * This file contains demo data that can be easily removed or modified.
 */

import type { SamplingMessage } from "../spec/current_spec.js";

export function generateDemoSamplingResponse(
  messages: SamplingMessage[],
  systemPrompt?: string,
  temperature?: number
): string {
  // Simulate LLM response based on the input messages
  let responseText = "This is a simulated LLM response";

  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (
      lastMessage.content &&
      typeof lastMessage.content === "object" &&
      "text" in lastMessage.content
    ) {
      const userText = lastMessage.content.text;

      // Generate contextual responses based on user input
      if (userText.toLowerCase().includes("hello")) {
        responseText = "Hello! How can I help you today?";
      } else if (userText.toLowerCase().includes("question")) {
        responseText = "That's a great question. Let me provide you with a detailed answer.";
      } else if (userText.toLowerCase().includes("code")) {
        responseText =
          "Here's a code example that should help with your request:\n\n```javascript\nconst example = 'demo code';\nconsole.log(example);\n```";
      } else if (userText.toLowerCase().includes("explain")) {
        responseText = "Let me explain this concept step by step to make it clear.";
      } else {
        responseText = `I understand you're asking about: "${userText}". Here's my response based on that context.`;
      }
    }
  }

  // Add system prompt influence if provided
  if (systemPrompt) {
    if (systemPrompt.toLowerCase().includes("concise")) {
      responseText = responseText.split(".")[0] + ".";
    } else if (systemPrompt.toLowerCase().includes("detailed")) {
      responseText +=
        " Let me provide additional context and examples to make this more comprehensive.";
    }
  }

  // Add temperature influence (higher = more creative/random)
  if (temperature && temperature > 0.7) {
    responseText += " [Simulated high-temperature creative response]";
  } else if (temperature && temperature < 0.3) {
    responseText += " [Simulated low-temperature precise response]";
  }

  return responseText;
}
