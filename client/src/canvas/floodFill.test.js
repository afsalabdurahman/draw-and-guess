import { describe, it, expect } from 'vitest';
import { floodFill, hexToRgba } from './floodFill';

describe('floodFill', () => {
  it('hexToRgba works correctly', () => {
    expect(hexToRgba('#ff0000')).toEqual([255, 0, 0, 255]);
    expect(hexToRgba('#00ff00')).toEqual([0, 255, 0, 255]);
    expect(hexToRgba('#ffffff')).toEqual([255, 255, 255, 255]);
  });

  it('fills a region correctly', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < data.length; i++) {
        data[i] = 255;
    }
    
    for (let y = 0; y < height; y++) {
        let pos = (y * width + 2) * 4;
        data[pos] = 0;
        data[pos+1] = 0;
        data[pos+2] = 0;
    }
    
    const imageData = { width, height, data };
    
    floodFill(imageData, 0, 0, '#ff0000', 0);
    
    expect(data[0]).toBe(255);
    expect(data[1]).toBe(0);
    
    let rightPos = 3 * 4;
    expect(data[rightPos]).toBe(255);
    expect(data[rightPos+1]).toBe(255);
  });
  
  it('is deterministic', () => {
    const width = 10;
    const height = 10;
    const data1 = new Uint8ClampedArray(width * height * 4);
    const data2 = new Uint8ClampedArray(width * height * 4);
    data1.fill(255);
    data2.fill(255);
    
    const img1 = { width, height, data: data1 };
    const img2 = { width, height, data: data2 };
    
    floodFill(img1, 5, 5, '#0000ff');
    floodFill(img2, 5, 5, '#0000ff');
    
    expect(img1.data).toEqual(img2.data);
  });
});
