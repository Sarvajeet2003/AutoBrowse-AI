# AutoBrowse-AI - AI-Powered Browser Automation

AutoBrowse-AI is an intelligent browser automation agent that allows users to control web browsers using natural language commands. This project demonstrates how AI can be used to interpret human instructions and translate them into browser actions.

## Features

- **Natural Language Commands**: Control the browser using plain English instructions
- **Multi-Site Support**: Works with popular websites like Google, YouTube, and Amazon
- **Intelligent Selector Handling**: Automatically tries multiple selectors to find elements
- **Data Extraction**: Extract structured data from web pages
- **Anti-Detection Measures**: Uses techniques to avoid being detected as automation
- **User-Friendly Interface**: Simple web UI for entering commands and viewing results

## Technology Stack

- **Backend**: Node.js with Express
- **Browser Automation**: Playwright
- **AI/NLP**: Google Gemini API
- **Frontend**: HTML, CSS, Bootstrap, JavaScript

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
2. Install dependencies:


Open your browser and navigate to `http://localhost:3000`

## Architecture
- Controller : Manages browser interactions using Playwright
- NL Processor : Interprets natural language commands
- API Layer : Provides endpoints for interaction and data extraction
- Web Interface : User-friendly UI for entering commands and viewing results
## Level 1 Implementation
The current implementation (Level 1) includes:

- Basic browser automation capabilities
- Command processing for Google and YouTube
- Special handling for Amazon (including CAPTCHA detection)
- Data extraction from web pages
- Web interface for interaction
## Future Enhancements (Planned)
- Support for more complex multi-step workflows
- Enhanced error recovery
- User authentication and saved command history
- Additional website-specific optimizations
- Mobile device simulation