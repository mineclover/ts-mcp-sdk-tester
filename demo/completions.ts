/**
 * Demo Completion Data
 * 
 * Sample completion suggestions for testing and demonstration purposes.
 * This file contains demo data that can be easily removed or modified.
 */

export const DEMO_PROMPT_COMPLETIONS: Record<string, string[]> = {
  name: ["John", "Jane", "Alice", "Bob", "Charlie"],
  language: ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java"],
  context: ["general", "specific", "detailed", "brief"],
  text: ["Sample text", "Lorem ipsum", "Example content"],
  length: ["brief", "medium", "detailed"],
};

export const DEMO_RESOURCE_COMPLETIONS: Record<string, string[]> = {
  path: [
    "/home/user/documents",
    "/tmp/temp-file.txt",
    "/var/log/app.log",
    "/etc/config.json",
  ],
  endpoint: ["users", "posts", "comments", "products", "orders"],
  id: ["1", "2", "3", "123", "456"],
  default: ["resource1", "resource2", "resource3"],
};

export function getDemoPromptCompletions(argumentName: string, argumentValue?: string): string[] {
  let completionValues = DEMO_PROMPT_COMPLETIONS[argumentName] || [
    `${argumentValue}_option1`,
    `${argumentValue}_option2`,
    `${argumentValue}_option3`,
  ];

  // Filter completions based on the current argument value
  if (argumentValue) {
    completionValues = completionValues.filter((value) =>
      value.toLowerCase().includes(argumentValue.toLowerCase())
    );
  }

  return completionValues;
}

export function getDemoResourceCompletions(uri: string, argumentValue?: string): string[] {
  let completionValues: string[] = [];

  if (uri.includes("{path}")) {
    completionValues = DEMO_RESOURCE_COMPLETIONS.path;
  } else if (uri.includes("{endpoint}")) {
    completionValues = DEMO_RESOURCE_COMPLETIONS.endpoint;
  } else if (uri.includes("{id}")) {
    completionValues = DEMO_RESOURCE_COMPLETIONS.id;
  } else {
    completionValues = DEMO_RESOURCE_COMPLETIONS.default;
  }

  // Filter completions based on the current argument value
  if (argumentValue) {
    completionValues = completionValues.filter((value) =>
      value.toLowerCase().includes(argumentValue.toLowerCase())
    );
  }

  return completionValues;
}