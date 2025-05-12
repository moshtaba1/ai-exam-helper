// Ensure this runs only once
var overlayInitialized = false;

// Make the initializeScreenshotCapture function globally accessible
window.initializeScreenshotCapture = initializeScreenshotCapture;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);
  
  if (message.action === 'startCapture') {
    console.log('Starting capture process via message');
    try {
      // Try the simplified version first
      createSimpleSelectionTool();
    } catch (e) {
      console.error("Simplified selection tool failed:", e);
      // Fall back to original method
      initializeScreenshotCapture();
    }
    sendResponse({ status: 'initialized' });
    return true;
  }
  
  if (message.action === 'captureSelected') {
    console.log('Processing selected area');
    processScreenshot(message.dataUrl, message.rect, message.scrollPosition);
    sendResponse({ status: 'processing' });
    return true;
  }
});

// Keep track of created overlay elements to ensure they can be removed
var overlayElements = {
  overlay: null,
  selection: null,
  instructions: null
};

// Define ESC handler function first
function escHandler(e) {
  if (e.key === 'Escape') {
    console.log('Selection cancelled with ESC key');
    cleanupOverlay();
    // Listener is removed in cleanupOverlay
  }
}

// Force-inject our custom styles to ensure the overlay is visible regardless of site styles
function injectStyles() {
  const styleEl = document.createElement('style');
  styleEl.id = 'screenshot-analyzer-styles';
  styleEl.textContent = `
    #screenshot-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background-color: rgba(0, 0, 0, 0.3) !important;
      z-index: 2147483647 !important;
      cursor: crosshair !important;
      pointer-events: auto !important;
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    #screenshot-selection {
      position: absolute !important;
      border: 3px dashed #FFCC00 !important;
      background-color: rgba(255, 204, 0, 0.1) !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    #screenshot-instructions {
      position: fixed !important;
      top: 20px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background-color: #333 !important;
      color: white !important;
      padding: 10px 20px !important;
      border-radius: 25px !important;
      font-family: Arial, sans-serif !important;
      font-size: 14px !important;
      z-index: 2147483647 !important;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3) !important;
      pointer-events: none !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;
  document.head.appendChild(styleEl);
  console.log('Screenshot analyzer styles injected');
}

function initializeScreenshotCapture() {
  if (overlayInitialized) {
    console.log('Overlay already initialized, skipping.');
    return;
  }
  overlayInitialized = true;

  try {
    console.log('STARTING SCREENSHOT CAPTURE...');
    
    // First, make sure any existing overlay is cleaned up
    cleanupExistingOverlay();
    
    // Inject our styles first to ensure visibility
    injectStyles();

    // Create the overlay elements with minimal styles - detailed styles in CSS
    const overlay = document.createElement('div');
    overlay.id = 'screenshot-overlay';
    
    const selection = document.createElement('div');
    selection.id = 'screenshot-selection';
    selection.style.display = 'none';
    
    const instructions = document.createElement('div');
    instructions.id = 'screenshot-instructions';
    instructions.textContent = 'Click and drag to select an area. Press ESC to cancel.';
    
    // Save references
    overlayElements.overlay = overlay;
    overlayElements.selection = selection;
    overlayElements.instructions = instructions;

    // Append elements to body
    document.body.appendChild(overlay);
    document.body.appendChild(selection);
    document.body.appendChild(instructions);
    
    console.log('OVERLAY ELEMENTS CREATED AND ADDED TO PAGE');
    
    // Variables to track the selection
    let isSelecting = false;
    let startX = 0, startY = 0;
    
    // Add Mouse Listeners using standard functions
    overlay.addEventListener('mousedown', function(e) {
      console.log('MOUSE DOWN AT:', e.clientX, e.clientY);
      isSelecting = true;
      startX = e.clientX;
      startY = e.clientY;
      selection.style.left = startX + 'px';
      selection.style.top = startY + 'px';
      selection.style.width = '0px';
      selection.style.height = '0px';
      selection.style.display = 'block';
    });
    
    overlay.addEventListener('mousemove', function(e) {
      if (!isSelecting) return;
      const currentX = e.clientX;
      const currentY = e.clientY;
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(startX, currentX);
      const top = Math.min(startY, currentY);
      selection.style.left = left + 'px';
      selection.style.top = top + 'px';
      selection.style.width = width + 'px';
      selection.style.height = height + 'px';
    });
    
    overlay.addEventListener('mouseup', function(e) {
      if (!isSelecting) return;
      isSelecting = false;
      
      console.log('MOUSE UP, SELECTION COMPLETE');
      
      // Get the final selection dimensions
      const rect = selection.getBoundingClientRect();
      
      // Only proceed if the selection has a reasonable size
      if (rect.width > 5 && rect.height > 5) { // Smaller threshold
        console.log('SELECTION MADE, DIMENSIONS:', rect);
        
        // Store selection dimensions before cleaning up
        const captureRect = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        };
        
        // Clean up the selection UI
        cleanupOverlay();
        
        // Ask the background script to capture the screen
        console.log('REQUESTING CAPTURE FROM BACKGROUND');
        chrome.runtime.sendMessage({
          action: 'captureVisibleTab',
          rect: captureRect
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error sending capture request:', chrome.runtime.lastError);
          } else {
            console.log('Capture request sent successfully');
          }
        });
      } else {
        console.log('Selection too small, ignoring');
        // Don't clean up, let the user try again
        selection.style.display = 'none';
      }
    });
    
    // Add ESC listener
    document.addEventListener('keydown', escHandler);
    
    console.log('SELECTION OVERLAY IS NOW ACTIVE - CLICK AND DRAG TO SELECT');
    
    // Alert user via browser alert that overlay is active (for debugging)
    // setTimeout(() => alert('Selection tool is active. Click and drag to select an area.'), 500);
    
  } catch (error) {
    console.error("ERROR INITIALIZING SCREENSHOT CAPTURE:", error);
    overlayInitialized = false; // Reset flag on error
    cleanupOverlay(); // Attempt cleanup on error
  }
}

function cleanupExistingOverlay() {
  // Check for any existing overlay elements and remove them
  const existingOverlay = document.getElementById('screenshot-overlay');
  const existingSelection = document.getElementById('screenshot-selection');
  const existingInstructions = document.getElementById('screenshot-instructions');
  
  if (existingOverlay) document.body.removeChild(existingOverlay);
  if (existingSelection) document.body.removeChild(existingSelection);
  if (existingInstructions) document.body.removeChild(existingInstructions);
}

function cleanupOverlay() {
  console.log('Cleaning up overlay');
  overlayInitialized = false; // Reset flag
  document.removeEventListener('keydown', escHandler); // Remove listener
  
  try {
    // Remove the style element
    const styleEl = document.getElementById('screenshot-analyzer-styles');
    if (styleEl) {
      styleEl.remove();
    }
    
    // Remove overlay elements
    if (overlayElements.overlay && overlayElements.overlay.parentNode) {
      overlayElements.overlay.parentNode.removeChild(overlayElements.overlay);
    }
    if (overlayElements.selection && overlayElements.selection.parentNode) {
      overlayElements.selection.parentNode.removeChild(overlayElements.selection);
    }
    if (overlayElements.instructions && overlayElements.instructions.parentNode) {
      overlayElements.instructions.parentNode.removeChild(overlayElements.instructions);
    }
    
    overlayElements = { overlay: null, selection: null, instructions: null };
  } catch (error) {
    console.error('Error during cleanup:', error);
    // Fallback cleanup
    cleanupExistingOverlay();
  }
}

function processScreenshot(dataUrl, rect, scrollPosition) {
  console.log('Processing screenshot with dimensions:', rect, 'scroll position:', scrollPosition);
  try {
    // Create a temporary image to get full dimensions
    const fullImg = new Image();
    fullImg.onload = () => {
      console.log('Original image loaded, dimensions:', fullImg.width, 'x', fullImg.height);
      
      // Create a canvas to crop the screenshot
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Set canvas dimensions to match the crop area exactly
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Clear the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate the scaling factor between the screenshot image and actual page dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight; 
      const scaleX = fullImg.width / viewportWidth;
      const scaleY = fullImg.height / viewportHeight;
      
      console.log('Scale factors:', { scaleX, scaleY });
      
      // For scrolled content, we need to adjust the top position based on scroll position
      let scaledLeft = rect.left * scaleX;
      let scaledTop = rect.top * scaleY;
      
      // If we have scroll position info, adjust the coordinates
      if (scrollPosition) {
        // We need to account for the scroll position in the original selection
        scaledTop = (rect.top - scrollPosition.y) * scaleY;
      }
      
      const scaledWidth = rect.width * scaleX;
      const scaledHeight = rect.height * scaleY;
      
      console.log('Adjusted scaled dimensions:', { scaledLeft, scaledTop, scaledWidth, scaledHeight });
      
      try {
        console.log('Drawing image section to canvas');
        context.drawImage(
          fullImg,
          scaledLeft,
          scaledTop,
          scaledWidth,
          scaledHeight,
          0, 0, canvas.width, canvas.height
        );
        
        // Convert the canvas to a data URL with high quality
        const screenshotDataUrl = canvas.toDataURL('image/png');
        console.log('Screenshot processed successfully');
        
        // Send the screenshot data to the popup via the background script
        chrome.runtime.sendMessage({
          action: 'screenshotCaptured',
          dataUrl: screenshotDataUrl
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Error sending screenshot data:', chrome.runtime.lastError);
          } else if (response && response.status === 'received') {
            console.log('Screenshot data sent successfully');
          }
        });
      } catch (error) {
        console.error('Error drawing image to canvas:', error);
        tryAlternativeCapture(fullImg, rect, scrollPosition);
      }
    };
    
    fullImg.onerror = (error) => {
      console.error('Error loading full image:', error);
      tryFallbackCapture(dataUrl, rect);
    };
    
    // Load the original image
    fullImg.src = dataUrl;
  } catch (error) {
    console.error('Error in processScreenshot:', error);
  }
}

function tryAlternativeCapture(img, rect, scrollPosition) {
  console.log('Trying alternative capture method');
  try {
    const canvas = document.createElement('canvas');
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const ctx = canvas.getContext('2d');
    
    // Calculate scaling factors
    const scaleX = img.width / window.innerWidth;
    const scaleY = img.height / window.innerHeight;
    
    // Apply scaling to coordinates
    let scaledLeft = rect.left * scaleX;
    let scaledTop = rect.top * scaleY;
    
    // Adjust for scrolling if needed
    if (scrollPosition) {
      scaledTop = (rect.top - scrollPosition.y) * scaleY;
    }
    
    const scaledWidth = rect.width * scaleX;
    const scaledHeight = rect.height * scaleY;
    
    ctx.drawImage(img, scaledLeft, scaledTop, scaledWidth, scaledHeight, 0, 0, rect.width, rect.height);
    
    const dataUrl = canvas.toDataURL('image/png');
    
    chrome.runtime.sendMessage({
      action: 'screenshotCaptured',
      dataUrl: dataUrl
    });
    
    console.log('Alternative capture completed');
  } catch (err) {
    console.error('Alternative capture failed:', err);
  }
}

function tryFallbackCapture(originalDataUrl, rect) {
  console.log('Trying fallback capture method');
  // Just send the full screenshot as a fallback
  chrome.runtime.sendMessage({
    action: 'screenshotCaptured',
    dataUrl: originalDataUrl
  });
}

// Simplest possible selection tool that works anywhere
function createSimpleSelectionTool(showAlert = false) {
  // First delete any existing overlay elements 
  document.querySelectorAll("#ss-overlay, #ss-selection, #ss-instructions, #ss-guide").forEach(el => el.remove());
  
  // Create fully new elements with inline styles
  const overlay = document.createElement('div');
  overlay.id = 'ss-overlay';
  overlay.style.cssText = `
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: ${Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)}px !important;
    background-color: rgba(0, 0, 0, 0.3) !important;
    z-index: 2147483647 !important;
    cursor: crosshair !important;
    pointer-events: auto !important;
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
  `;

  const selection = document.createElement('div');
  selection.id = 'ss-selection';
  selection.style.cssText = `
    position: absolute !important;
    border: 2px dashed #FF0000 !important;
    background-color: rgba(0, 0, 0, 0.05) !important;
    z-index: 2147483647 !important;
    display: none !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: none !important;
  `;

  // We'll only use the central guide, not the top instructions
  const guide = document.createElement('div');
  guide.id = 'ss-guide';
  guide.style.cssText = `
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    background-color: rgba(0, 0, 0, 0.8) !important;
    color: white !important;
    padding: 15px 25px !important;
    border-radius: 8px !important;
    font-family: Arial, sans-serif !important;
    font-size: 18px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4) !important;
    text-align: center !important;
    max-width: 80% !important;
  `;
  guide.innerHTML = "<strong>CLICK AND DRAG</strong> to select an area.<br>Press <strong>ESC</strong> to cancel.";
  
  // Add elements to body
  document.body.appendChild(overlay);
  document.body.appendChild(selection);
  document.body.appendChild(guide);
  
  // Show alert to confirm it's working (optional)
  if (showAlert) {
    alert("Selection tool activated. Click and drag to select an area.");
  }
  
  // For selection functionality
  let isSelecting = false;
  let startX = 0, startY = 0;
  
  // Get scroll position
  const getScrollX = () => window.scrollX || window.pageXOffset;
  const getScrollY = () => window.scrollY || window.pageYOffset;
  
  overlay.addEventListener('mousedown', function(e) {
    isSelecting = true;
    // Include scroll position for absolute positioning
    startX = e.pageX;
    startY = e.pageY;
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
    selection.style.display = 'block';
    guide.style.display = 'none'; // Hide guide when selection starts
  });
  
  overlay.addEventListener('mousemove', function(e) {
    if (!isSelecting) return;
    // Use pageX/pageY for coordinates that include scrolling
    const currentX = e.pageX;
    const currentY = e.pageY;
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
  });
  
  overlay.addEventListener('mouseup', function(e) {
    if (!isSelecting) return;
    isSelecting = false;
    
    // Store the selection coordinates BEFORE removing overlay
    const selRect = {
      left: parseInt(selection.style.left, 10),
      top: parseInt(selection.style.top, 10),
      width: parseInt(selection.style.width, 10),
      height: parseInt(selection.style.height, 10)
    };
    
    // Only proceed if selection is big enough
    if (selRect.width > 10 && selRect.height > 10) {
      // Capture dimensions
      const captureRect = {
        left: selRect.left,
        top: selRect.top,
        width: selRect.width,
        height: selRect.height
      };
      
      console.log("CAPTURING AREA (Absolute coordinates):", captureRect);
      
      // IMPORTANT: Remove all overlay elements BEFORE sending the capture request
      // This prevents the overlay from appearing in the screenshot
      document.querySelectorAll("#ss-overlay, #ss-selection, #ss-guide").forEach(el => el.remove());
      
      // Wait a slight moment for DOM to update before capture
      setTimeout(() => {
        // Ensure the selected area is visible before capture
        ensureVisibleBeforeCapture(captureRect, (rect, scrollPosition) => {
          // Capture screenshot via background script
          chrome.runtime.sendMessage({
            action: 'captureVisibleTab',
            rect: rect,
            scrollPosition: scrollPosition,
            fullPage: true,
            totalHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
            viewportHeight: window.innerHeight
          });
        });
      }, 50);
    } else {
      // Reset for another attempt
      selection.style.display = 'none';
      guide.style.display = 'block'; // Show guide again
    }
  });
  
  // Add ESC key handler to cancel
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll("#ss-overlay, #ss-selection, #ss-guide").forEach(el => el.remove());
      document.removeEventListener('keydown', escHandler);
    }
  });
}

// Make it globally accessible for direct execution
window.createSimpleSelectionTool = createSimpleSelectionTool;

// Also make our original function accessible
window.initializeScreenshotCapture = initializeScreenshotCapture;

// Listen for messages from the popup or background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);
  
  if (message.action === 'startCapture') {
    console.log('Starting capture process via message');
    try {
      // Try the simplified version first
      createSimpleSelectionTool();
    } catch (e) {
      console.error("Simplified selection tool failed:", e);
      // Fall back to original method
      initializeScreenshotCapture();
    }
    sendResponse({ status: 'initialized' });
    return true;
  }
  
  if (message.action === 'captureSelected') {
    console.log('Processing selected area');
    processScreenshot(message.dataUrl, message.rect, message.scrollPosition);
    sendResponse({ status: 'processing' });
    return true;
  }
});

// Add this function to scroll to ensure the target area is visible before capture
function ensureVisibleBeforeCapture(rect, callback) {
  console.log('Ensuring area is visible for capture:', rect);
  
  // Get current scroll position
  const initialScrollX = window.scrollX || window.pageXOffset;
  const initialScrollY = window.scrollY || window.pageYOffset;
  
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  
  // Determine if the selected area is outside the current viewport
  const isAboveViewport = rect.top < initialScrollY;
  const isBelowViewport = rect.top + rect.height > initialScrollY + viewportHeight;
  const isLeftOfViewport = rect.left < initialScrollX;
  const isRightOfViewport = rect.left + rect.width > initialScrollX + viewportWidth;
  
  // If the selection is entirely within the viewport, no need to scroll
  if (!isAboveViewport && !isBelowViewport && !isLeftOfViewport && !isRightOfViewport) {
    console.log('Selection is already within viewport, no scrolling needed');
    callback(rect, { x: initialScrollX, y: initialScrollY });
    return;
  }
  
  // Calculate the best scroll position to make the selection visible
  // We prioritize keeping as much of the selection visible as possible
  let targetScrollX = initialScrollX;
  let targetScrollY = initialScrollY;
  
  // Calculate vertical scroll position
  if (isAboveViewport) {
    // Scroll up to see the top of the selection
    targetScrollY = Math.max(0, rect.top - 50); // 50px buffer
  } else if (isBelowViewport) {
    // Scroll down to see the bottom of the selection
    targetScrollY = Math.max(0, (rect.top + rect.height) - viewportHeight + 50);
  }
  
  // Calculate horizontal scroll position
  if (isLeftOfViewport) {
    // Scroll left to see the left edge of selection
    targetScrollX = Math.max(0, rect.left - 50);
  } else if (isRightOfViewport) {
    // Scroll right to see the right edge of selection
    targetScrollX = Math.max(0, (rect.left + rect.width) - viewportWidth + 50);
  }
  
  console.log(`Scrolling to position X: ${targetScrollX}, Y: ${targetScrollY}`);
  
  // Scroll to the new position
  window.scrollTo({
    left: targetScrollX,
    top: targetScrollY,
    behavior: 'auto' // Use 'auto' for immediate scroll without animation
  });
  
  // Wait a short moment for the scroll to complete and browser to render
  setTimeout(() => {
    // Get the final scroll position (might be different from target if scroll limits were reached)
    const finalScrollX = window.scrollX || window.pageXOffset;
    const finalScrollY = window.scrollY || window.pageYOffset;
    
    console.log(`Scrolled to position X: ${finalScrollX}, Y: ${finalScrollY}`);
    
    // Call the callback with the rect and final scroll position
    callback(rect, { x: finalScrollX, y: finalScrollY });
  }, 100); // Short delay to ensure the scroll is complete
} 