# Demo Data Directory

This directory contains all demo/sample data used by the MCP SDK Tester for testing and demonstration purposes.

## 📁 Structure

```
demo/
├── README.md           # This file
├── index.ts           # Central exports for all demo data
├── resources.ts       # Demo resource definitions and content
├── prompts.ts         # Demo prompt templates and messages  
├── tools.ts           # Demo tool definitions and execution logic
└── elicitation.ts     # Demo elicitation response generation
```

## 🎯 Purpose

The demo data serves several purposes:

1. **Testing**: Provides consistent test data for development and debugging
2. **Documentation**: Shows examples of how MCP protocol features work
3. **Development**: Enables quick iteration without requiring real integrations
4. **Separation**: Keeps demo/test data separate from production logic

## 🔧 Usage

Demo data is automatically imported and used by the standard MCP endpoints:

- **Resources**: Sample resources with different content types (text, JSON, files)
- **Prompts**: Template prompts with argument handling (greeting, code-review, etc.)
- **Tools**: Functional tools for basic operations (echo, calculator, file-info, random-number)
- **Elicitation**: Simulated user input generation based on JSON schemas

## 🗑️ Removal

To remove demo data for production use:

1. **Delete this directory**: `rm -rf demo/`
2. **Update imports**: Remove demo imports from `standard/` files
3. **Replace implementations**: Add real implementations for resources, tools, and prompts
4. **Update references**: Replace `DEMO_*` constants with real data sources

## 🔄 Customization

To customize demo data:

1. **Modify existing data**: Edit the arrays and functions in the individual files
2. **Add new items**: Extend the demo arrays with additional examples
3. **Update logic**: Modify execution functions to match your needs
4. **Configuration**: Adjust `DEMO_CONFIG` in `index.ts` for global settings

## 📋 Demo Data Summary

### Resources (3 items)
- `test://resource1` - Plain text resource
- `test://resource2` - JSON data resource  
- `file:///sample.txt` - File system resource

### Prompts (4 items)
- `greeting` - Simple greeting with name parameter
- `code-review` - Code review prompt with language and context
- `simple-prompt` - Basic prompt without arguments
- `summarize` - Text summarization with length options

### Tools (4 items)
- `echo` - Echoes back input message
- `calculator` - Basic math operations (add, subtract, multiply, divide)
- `file-info` - Simulated file information retrieval
- `random-number` - Random number generation within range

### Completions
- **Prompt completions**: name, language, context, text, length parameters
- **Resource completions**: path, endpoint, id parameters for template URIs

### Sampling
- Context-aware LLM response simulation with system prompt and temperature support

### Roots (5 items)
- Development directories and servers
- Git repositories
- Local development environments

All demo data includes proper typing, validation, and error handling to demonstrate best practices for MCP server implementation.