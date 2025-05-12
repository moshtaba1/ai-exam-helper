# AI Exam Helper

A Chrome extension that captures screenshots of exam questions and uses AI (Llama-4 via OpenRouter) to analyze and solve them.

## Features

- 📸 **Screenshot Capture**: Select any area of a webpage to capture
- 🧠 **AI-Powered Analysis**: Utilizes Llama-4 Maverick model for accurate responses
- 🔍 **Exam Question Solutions**: Get step-by-step solutions for math, science, and other exam questions
- 📱 **Responsive UI**: Clean, modern interface with enhanced text readability
- 🚀 **Quick Workflow**: Capture, analyze, and get results in seconds

## Installation

### From Chrome Web Store
*Coming soon*

### Manual Installation (Developer Mode)

1. Download or clone this repository:
   ```
   git clone https://github.com/moshtaba1/ai-exam-helper.git
   ```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now appear in your Chrome toolbar

## Usage

1. Navigate to any webpage with an exam question
2. Click on the AI Exam Helper icon in your toolbar
3. Click the "Capture Screenshot" button
4. Use your mouse to select the area containing the question:
   - Click and drag to select the area
   - Release to capture
5. Review the screenshot in the preview window
6. Click "Analyze with AI" to process the image
7. View the AI's detailed solution and explanation

## How It Works

The extension uses a multi-step process:
1. Captures a screenshot of your selected area
2. Processes and crops the image to include only the relevant content
3. Sends the image to OpenRouter's API with the Llama-4 Maverick model
4. Presents the AI's analysis and solution in a clean, readable format

## Privacy and Data Usage

- ✅ Screenshots are only sent to OpenRouter for analysis
- ✅ No images or questions are stored permanently
- ✅ No personal data is collected
- ✅ The extension requires minimal permissions

## API Configuration

The extension uses the OpenRouter API to access the Llama-4 Maverick model. The API key is pre-configured, but you can modify it in the `popup.js` file if needed.

## Development

### Project Structure
- `manifest.json`: Extension configuration
- `popup.html/js/css`: UI components and logic
- `content.js`: Screenshot capture functionality
- `background.js`: Background processes and API communication

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## Credits

Developed by Mojtaba Taheri
