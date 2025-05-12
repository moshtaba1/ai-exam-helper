// Simple script to create icons of different sizes
const fs = require('fs');
const { createCanvas } = require('canvas');

// Create icons in 16x16, 48x48, and 128x128 sizes
const sizes = [16, 48, 128];

sizes.forEach(size => {
  // Create a canvas with the specified size
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Fill the background with a gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#6e8efb');
  gradient.addColorStop(1, '#a777e3');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Draw a camera icon in the center
  const padding = size * 0.2;
  const iconSize = size - (padding * 2);
  
  // Draw a simple camera shape
  ctx.fillStyle = 'white';
  ctx.beginPath();
  
  // Camera body
  const bodyWidth = iconSize * 0.8;
  const bodyHeight = iconSize * 0.6;
  const bodyX = (size - bodyWidth) / 2;
  const bodyY = (size - bodyHeight) / 2 + iconSize * 0.1;
  
  ctx.roundRect(bodyX, bodyY, bodyWidth, bodyHeight, size * 0.1);
  
  // Camera lens
  const lensRadius = iconSize * 0.2;
  const lensX = size / 2;
  const lensY = size / 2 + iconSize * 0.1;
  
  ctx.moveTo(lensX + lensRadius, lensY);
  ctx.arc(lensX, lensY, lensRadius, 0, Math.PI * 2);
  
  // Camera top part
  const topWidth = bodyWidth * 0.4;
  const topHeight = iconSize * 0.15;
  const topX = (size - topWidth) / 2;
  const topY = bodyY - topHeight;
  
  ctx.roundRect(topX, topY, topWidth, topHeight, size * 0.05);
  
  ctx.fill();
  
  // Save the icon to a file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icon${size}.png`, buffer);
});

console.log('Icons created successfully!'); 