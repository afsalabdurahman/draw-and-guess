export function hexToRgba(hex) {
  let c;
  if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
    c = hex.substring(1).split('');
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c = '0x' + c.join('');
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
  }
  return [0, 0, 0, 255]; 
}

export function colorsMatch(data, pos, targetColor, tolerance = 10) {
  const r = data[pos];
  const g = data[pos + 1];
  const b = data[pos + 2];
  const a = data[pos + 3];

  return (
    Math.abs(r - targetColor[0]) <= tolerance &&
    Math.abs(g - targetColor[1]) <= tolerance &&
    Math.abs(b - targetColor[2]) <= tolerance &&
    Math.abs(a - targetColor[3]) <= tolerance
  );
}

export function floodFill(imageData, startX, startY, fillColorHex, tolerance = 30) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  const fillRgba = hexToRgba(fillColorHex);

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) {
    return imageData;
  }

  const startPos = (startY * width + startX) * 4;
  const targetColor = [
    data[startPos],
    data[startPos + 1],
    data[startPos + 2],
    data[startPos + 3],
  ];

  if (
    Math.abs(targetColor[0] - fillRgba[0]) <= tolerance &&
    Math.abs(targetColor[1] - fillRgba[1]) <= tolerance &&
    Math.abs(targetColor[2] - fillRgba[2]) <= tolerance &&
    Math.abs(targetColor[3] - fillRgba[3]) <= tolerance
  ) {
    return imageData;
  }

  const stack = [[startX, startY]];
  
  while (stack.length > 0) {
    let [x, y] = stack.pop();
    
    let pos = (y * width + x) * 4;
    
    while (y >= 0 && colorsMatch(data, pos, targetColor, tolerance)) {
      y--;
      pos -= width * 4;
    }
    
    pos += width * 4;
    y++;
    
    let reachLeft = false;
    let reachRight = false;
    
    while (y < height && colorsMatch(data, pos, targetColor, tolerance)) {
      data[pos] = fillRgba[0];
      data[pos + 1] = fillRgba[1];
      data[pos + 2] = fillRgba[2];
      data[pos + 3] = fillRgba[3];
      
      if (x > 0) {
        if (colorsMatch(data, pos - 4, targetColor, tolerance)) {
          if (!reachLeft) {
            stack.push([x - 1, y]);
            reachLeft = true;
          }
        } else if (reachLeft) {
          reachLeft = false;
        }
      }
      
      if (x < width - 1) {
        if (colorsMatch(data, pos + 4, targetColor, tolerance)) {
          if (!reachRight) {
            stack.push([x + 1, y]);
            reachRight = true;
          }
        } else if (reachRight) {
          reachRight = false;
        }
      }
      
      y++;
      pos += width * 4;
    }
  }
  
  return imageData;
}
