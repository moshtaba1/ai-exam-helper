// Background script for AI Exam Helper
let capturedScreenshot = null;
let popupOpen = false;

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Exam Helper extension installed');
});

// Keep track of when popup is opened or closed
chrome.runtime.onConnect.addListener(function(port) {
  if (port.name === "popup") {
    console.log("Popup connected");
    popupOpen = true;
    
    port.onDisconnect.addListener(function() {
      console.log("Popup disconnected");
      popupOpen = false;
    });
  }
});

// Listen for messages from content scripts and forward them to the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action);
  
  if (message.action === 'startCapture') {
    console.log('Starting capture process from direct call');
    handleStartCapture(sendResponse);
    return true;
  }
  
  if (message.action === 'screenshotCaptured') {
    // Store the screenshot data
    capturedScreenshot = message.dataUrl;
    console.log('Screenshot data received, opening popup');
    
    // Open the popup if it's not already open
    try {
      chrome.action.openPopup().catch(() => {
        console.log('Could not open popup automatically. User needs to click the extension icon.');
      });
    } catch (error) {
      console.error('Error opening popup:', error);
    }
    
    // Forward the message to the popup (if open)
    try {
      chrome.runtime.sendMessage({
        action: 'screenshotCaptured',
        dataUrl: message.dataUrl
      }).catch(err => {
        console.log('Could not send to popup yet - it will get the data when opened:', err);
      });
    } catch (error) {
      console.error('Error forwarding screenshot to popup:', error);
    }
    
    sendResponse({ status: 'received' });
    return true;
  }
  
  if (message.action === 'getScreenshot') {
    // Send the stored screenshot data to the popup
    if (capturedScreenshot) {
      sendResponse({ 
        status: 'success', 
        dataUrl: capturedScreenshot 
      });
      return true;
    } else {
      sendResponse({ 
        status: 'error', 
        message: 'No screenshot available' 
      });
      return true;
    }
  }
  
  if (message.action === 'captureVisibleTab') {
    console.log('Capturing visible tab with details:', message.rect, 'scrollPosition:', message.scrollPosition);
    
    // Capture the current tab
    chrome.tabs.captureVisibleTab(null, { format: 'png', quality: 100 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('Error capturing tab:', chrome.runtime.lastError);
        sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
        return;
      }
      
      console.log('Tab captured, sending to content script for processing');
      // Send the dataUrl, rect, and scroll position to the content script for processing
      try {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: 'captureSelected',
          dataUrl: dataUrl,
          rect: message.rect,
          scrollPosition: message.scrollPosition  // Pass scroll position
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending captured image to content script:', chrome.runtime.lastError);
          } else {
            console.log('Image sent to content script for processing:', response);
          }
        });
        
        // Let the content script know the request was received
        sendResponse({ status: 'processing' });
      } catch (error) {
        console.error('Error sending captured tab to content script:', error);
        sendResponse({ status: 'error', error: error.message });
      }
    });
    return true;
  }
  
  return false;
});

// Function for handling the start capture process
function handleStartCapture(sendResponse) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error('Error: No active tab found');
      if (sendResponse) sendResponse({ status: 'error', error: 'No active tab found' });
      return;
    }
    
    const activeTab = tabs[0];
    console.log('Active tab found:', activeTab.id);
    
    // Set a flag in storage to indicate capture is in progress
    chrome.storage.local.set({ 'captureInProgress': true }, function() {
      console.log('Capture flag set in storage');
    });
    
    // First, inject the content script and then call the function with a short delay
    chrome.scripting.executeScript(
      {
        target: { tabId: activeTab.id },
        files: ['content.js']
      }
    ).then(() => {
      console.log('Content script injected successfully, waiting briefly before activating...');
      
      // Add a small delay to ensure the content script is ready
      setTimeout(() => {
        // Now directly execute the capture function
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          function: () => {
            console.log('Direct execution in the page context');
            
            // First try the simpler method
            if (typeof window.createSimpleSelectionTool === 'function') {
              try {
                console.log("Using simple selection tool");
                // Call without showing alert by default
                window.createSimpleSelectionTool(false);
                return { success: true, message: 'Simple selection tool activated' };
              } catch (err) {
                console.error("Simple selection tool failed:", err);
                // Fall back to original method if simple fails
              }
            }
            
            // Fall back to original method
            try {
              // Call the initializeScreenshotCapture function if it exists
              if (typeof window.initializeScreenshotCapture === 'function') {
                window.initializeScreenshotCapture();
                return { success: true, message: 'Initialized via window function' };
              } else if (typeof initializeScreenshotCapture === 'function') {
                initializeScreenshotCapture();
                return { success: true, message: 'Initialized via direct function' };
              } else {
                console.error('Screenshot function not found');
                throw new Error('Function not found');
              }
            } catch (err) {
              console.error('Error in direct execution:', err);
              return { error: err.message || 'Unknown error in direct execution' };
            }
          }
        })
        .then((results) => {
          console.log('Execute script results:', results);
          if (results && results[0] && results[0].result && results[0].result.success) {
            console.log('Capture initialized successfully:', results[0].result.message);
            if (sendResponse) sendResponse({ status: 'success' });
          } else {
            console.error('Failed to initialize capture directly, trying message method');
            
            // Try the message method as a fallback
            chrome.tabs.sendMessage(activeTab.id, { action: 'startCapture' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError);
                if (sendResponse) sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
              } else if (response && response.status === 'initialized') {
                console.log('Capture initialized successfully via message');
                if (sendResponse) sendResponse({ status: 'success' });
              } else {
                console.error('Unexpected response:', response);
                if (sendResponse) sendResponse({ status: 'error', error: 'Failed to initialize capture' });
              }
            });
          }
        })
        .catch((error) => {
          console.error('Error during script execution:', error);
          if (sendResponse) sendResponse({ status: 'error', error: error.message });
        });
      }, 100); // Short delay before activating
    }).catch((error) => {
      console.error('Error injecting content script:', error);
      if (sendResponse) sendResponse({ status: 'error', error: error.message });
    });
  });
} 