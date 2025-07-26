/**
 * Demo Resource Data
 * 
 * Sample resources for testing and demonstration purposes.
 * This file contains demo data that can be easily removed or modified.
 */

import type { Resource, TextResourceContents, BlobResourceContents } from "../spec/current_spec.js";

export const DEMO_RESOURCES: Resource[] = [
  {
    name: "test-resource-1",
    title: "Test Resource 1",
    uri: "test://resource1",
    description: "A sample test resource for demonstration",
    mimeType: "text/plain",
    size: 100,
  },
  {
    name: "test-resource-2",
    title: "Test Resource 2",
    uri: "test://resource2",
    description: "Another sample test resource",
    mimeType: "application/json",
    size: 200,
  },
  {
    name: "sample-file",
    title: "Sample File Resource",
    uri: "file:///sample.txt",
    description: "Sample file resource",
    mimeType: "text/plain",
    size: 150,
  },
];

export function getDemoResourceContent(uri: string): (TextResourceContents | BlobResourceContents)[] {
  if (uri === "test://resource1") {
    return [
      {
        uri,
        text: "This is the content of test resource 1.\nIt contains sample text data.",
        mimeType: "text/plain",
        _meta: {
          readTime: new Date().toISOString(),
          size: 54,
        },
      },
    ];
  } else if (uri === "test://resource2") {
    return [
      {
        uri,
        text: JSON.stringify(
          {
            message: "This is test resource 2",
            data: {
              value: 42,
              active: true,
              timestamp: new Date().toISOString(),
            },
          },
          null,
          2
        ),
        mimeType: "application/json",
        _meta: {
          readTime: new Date().toISOString(),
          size: 120,
        },
      },
    ];
  } else if (uri.startsWith("file:///")) {
    // Sample file resource
    const filename = uri.split("/").pop() || "unknown";
    return [
      {
        uri,
        text: `Content of file: ${filename}\nThis is simulated file content.`,
        mimeType: "text/plain",
        _meta: {
          readTime: new Date().toISOString(),
          size: 40,
        },
      },
    ];
  }
  
  throw new Error(`Resource not found: ${uri}`);
}