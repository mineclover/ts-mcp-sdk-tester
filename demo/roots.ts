/**
 * Demo Roots Data
 *
 * Sample root URIs for testing and demonstration purposes.
 * This file contains demo data that can be easily removed or modified.
 */

import type { Root } from "../spec/current_spec.js";

export const DEMO_ROOTS: Root[] = [
  {
    uri: "file:///Users/developer/projects",
    name: "Projects Directory",
    _meta: {
      description: "Main development projects folder",
      type: "directory",
    },
  },
  {
    uri: "file:///Users/developer/documents",
    name: "Documents",
    _meta: {
      description: "User documents and files",
      type: "directory",
    },
  },
  {
    uri: "file:///tmp",
    name: "Temporary Files",
    _meta: {
      description: "Temporary file storage",
      type: "directory",
    },
  },
  {
    uri: "http://localhost:3000",
    name: "Local Development Server",
    _meta: {
      description: "Local web server for development",
      type: "server",
    },
  },
  {
    uri: "git://github.com/user/repo",
    name: "Git Repository",
    _meta: {
      description: "Source code repository",
      type: "repository",
    },
  },
];
