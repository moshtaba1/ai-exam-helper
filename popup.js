// Store OpenRouter API key
const OPENROUTER_API_KEY = '';
const SITE_NAME = 'AI Exam Helper';
const SITE_URL = 'chrome-extension://ai-exam-helper';

document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // Connect to the background script to indicate the popup is open
  const port = chrome.runtime.connect({name: "popup"});
  
  // Get DOM elements
  const introSection = document.getElementById('intro-section');
  const previewSection = document.getElementById('preview-section');
  const loadingSection = document.getElementById('loading-section');
  const resultSection = document.getElementById('result-section');
  
  const captureBtn = document.getElementById('capture-btn');
  const screenshotPreview = document.getElementById('screenshot-preview');
  const retakeBtn = document.getElementById('retake-btn');
  const analyzeBtn = document.getElementById('analyze-btn');
  const newCaptureBtn = document.getElementById('new-capture-btn');
  const aiResponse = document.getElementById('ai-response');
  
  let screenshotData = null;
  
  // Event handlers
  captureBtn.addEventListener('click', captureScreenshot);
  retakeBtn.addEventListener('click', captureScreenshot);
  analyzeBtn.addEventListener('click', analyzeScreenshot);
  newCaptureBtn.addEventListener('click', captureScreenshot);
  
  // Check if we already have a screenshot from background
  checkForExistingScreenshot();
  
  function checkForExistingScreenshot() {
    console.log('Checking for existing screenshot...');
    chrome.runtime.sendMessage({ action: 'getScreenshot' }, (response) => {
      console.log('[checkForExistingScreenshot] Response received:', response ? 'Response exists' : 'No response'); 
      if (chrome.runtime.lastError) {
        console.error('[checkForExistingScreenshot] Error:', chrome.runtime.lastError);
        showIntroSection();
        return;
      }

      // Explicitly check response structure and values
      const isSuccess = response && response.status === 'success';
      const hasDataUrl = response && typeof response.dataUrl === 'string' && response.dataUrl.startsWith('data:image');
      console.log(`[checkForExistingScreenshot] isSuccess: ${isSuccess}, hasDataUrl: ${hasDataUrl}`);

      if (isSuccess && hasDataUrl) {
        console.log('[checkForExistingScreenshot] Condition met, showing preview.');
        screenshotData = response.dataUrl;
        
        // Set pure data URL without any modifications
        screenshotPreview.src = screenshotData;
        
        // Wait for image to load before showing section
        screenshotPreview.onload = () => {
            console.log('[checkForExistingScreenshot] Screenshot loaded in preview, showing section.');
            showPreviewSection(); 
        };
        screenshotPreview.onerror = (err) => {
            console.error('[checkForExistingScreenshot] Error loading preview image:', err);
            showIntroSection(); // Show intro if preview fails to load
        };

      } else {
        console.log('[checkForExistingScreenshot] Condition NOT met or invalid dataUrl, showing intro section.');
        showIntroSection();
      }
    });
  }
  
  function showIntroSection() {
    console.log('Showing intro section');
    introSection.classList.remove('hidden');
    previewSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    // Reset loading message in intro section if needed
    const introContent = introSection.querySelector('p');
    if (introContent && introContent.textContent.includes('Loading')) {
        introSection.innerHTML = '<p>Take a screenshot of an area on your page and let AI analyze it.</p><button id="capture-btn" class="primary-btn">Capture Screenshot</button>';
        // Re-attach event listener to the new button
        document.getElementById('capture-btn').addEventListener('click', captureScreenshot);
    }
  }
  
  function showPreviewSection() {
    console.log('Showing preview section');
    introSection.classList.add('hidden');
    previewSection.classList.remove('hidden');
    loadingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
  }
  
  function showLoadingSection() {
    console.log('Showing loading section');
    introSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
  }
  
  function showResultSection() {
    console.log('Showing result section');
    introSection.classList.add('hidden');
    previewSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
  }
  
  function captureScreenshot() {
    console.log('Capture button clicked');
    
    // Show a more detailed message to inform the user
    introSection.innerHTML = `
      <p>Activating screenshot tool...</p>
      <div class="loader"></div>
      <p style="font-size: 15px; margin-top: 15px;">
        After the popup closes, you'll see a selection tool appear.<br>
        <span style="font-size: 14px; color: #666; display: block; margin-top: 8px;">
          Click and drag to select the area you want to capture
        </span>
      </p>
    `;
    
    // Tell the background script to start the screenshot capture process
    chrome.runtime.sendMessage(
      { action: 'startCapture' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error starting capture:', chrome.runtime.lastError);
          aiResponse.textContent = 'Error: ' + chrome.runtime.lastError.message;
          showResultSection();
          return;
        }
        
        console.log('Response from background:', response);
        if (response && response.status === 'success') {
          console.log('Closing popup to allow selection');
          // Close the popup to allow the user to select an area
          setTimeout(() => window.close(), 500);
        } else {
          console.error('Failed to start capture:', response);
          // Try a more direct approach as a last resort
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs && tabs.length > 0) {
              chrome.tabs.executeScript(
                tabs[0].id,
                {code: 'if(typeof createSimpleSelectionTool==="function")createSimpleSelectionTool(false);else alert("Unable to activate selection tool");'},
                () => {
                  if (chrome.runtime.lastError) {
                    console.error('Direct script injection failed:', chrome.runtime.lastError);
                    aiResponse.textContent = 'Error: Failed to start the screenshot tool. Please try refreshing the page.';
                    showResultSection();
                  } else {
                    setTimeout(() => window.close(), 300);
                  }
                }
              );
            } else {
              aiResponse.textContent = 'Error: Could not find active tab. Please try again.';
              showResultSection();
            }
          });
        }
      }
    );
  }
  
  // Listen for the screenshot data from the content script via background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message.action);
    if (message.action === 'screenshotCaptured') {
      console.log('Screenshot received in popup, data length:', message.dataUrl ? message.dataUrl.length : 'undefined');
      
      // Store the screenshot data
      screenshotData = message.dataUrl;
      
      // Don't add cache parameters to data URLs - they break the format
      screenshotPreview.onload = () => {
        console.log('Screenshot preview loaded successfully');
        showPreviewSection();
      };
      
      screenshotPreview.onerror = (error) => {
        console.error('Error loading screenshot preview:', error);
        // Try recreating the image element with the pure data URL
        const newImg = new Image();
        newImg.id = 'screenshot-preview';
        newImg.onload = () => {
          console.log('Screenshot preview loaded on second attempt');
          showPreviewSection();
        };
        newImg.onerror = () => {
          console.error('Failed to load preview on second attempt');
          aiResponse.textContent = 'Error: Failed to display screenshot. Please try again.';
          showResultSection();
        };
        
        // Replace the existing image
        if (screenshotPreview.parentNode) {
          screenshotPreview.parentNode.replaceChild(newImg, screenshotPreview);
          screenshotPreview = newImg;
          // Set pure data URL without any additions
          newImg.src = screenshotData;
        }
      };
      
      // Set pure data URL without any cache parameter
      screenshotPreview.src = screenshotData;
      
      sendResponse({ status: 'received' });
      return true;
    }
  });
  
  async function analyzeScreenshot() {
    if (!screenshotData) {
      console.error('No screenshot data available for analysis');
      aiResponse.textContent = 'Error: No screenshot available. Please capture a screenshot first.';
      showResultSection();
      return;
    }
    
    showLoadingSection();
    console.log('Sending image to API for analysis');
    
    try {
      // Check if data URL is too long (optional resizing)
      if (screenshotData.length > 5000000) { // Example limit: 5MB
        console.log('Image potentially large, consider resizing if issues persist.');
        // screenshotData = await resizeImage(screenshotData, 0.7); // Uncomment if needed
      }
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": SITE_URL,
          "X-Title": SITE_NAME,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-maverick:free",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "I'm taking an exam and need your help. If this image contains an exam question or test problem, please solve it step by step and explain the answer in detail. If it's a math problem, show the full calculation. If it's a multiple choice question, explain why the correct answer is right and others are wrong. If it's not an exam question, just describe what you see in the image."
                },
                {
                  type: "image_url",
                  image_url: { url: screenshotData }
                }
              ]
            }
          ]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response Text:', errorText);
        throw new Error(`API responded with status ${response.status}: ${errorText}`);
      }
      
      console.log('Response received from API');
      const data = await response.json();
      console.log('API response data:', data);
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
        const content = data.choices[0].message.content;
        aiResponse.textContent = content;
      } else {
        console.error('Invalid or unexpected API response structure:', data);
        throw new Error('Invalid response structure from API.');
      }
      
      showResultSection();
    } catch (error) {
      console.error('Error analyzing screenshot:', error);
      aiResponse.textContent = `Error: ${error.message || 'Failed to analyze the image.'}\n\nTroubleshooting:\n1. Ensure OpenRouter API key is valid & has credits.\n2. Check internet connection.\n3. Try a clearer/smaller screenshot.\n4. Check browser console for details.`;
      showResultSection();
    }
  }
  
  // Function to resize an image (keep if needed, ensure it works)
  function resizeImage(dataUrl, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(resizedDataUrl);
      };
      img.onerror = function(error) {
        reject(error);
      };
      img.src = dataUrl;
    });
  }
}); 