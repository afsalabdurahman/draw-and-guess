import { floodFill } from './floodFill';

export const renderOps = (ctx, ops, width = 800, height = 600) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const op of ops) {
    if (op.type === 'clear') {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      continue;
    }

    if (op.type === 'stroke') {
      if (!op.points || op.points.length === 0) continue;

      ctx.globalCompositeOperation = op.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.size;

      ctx.beginPath();
      const first = op.points[0];
      ctx.moveTo(first.x * width, first.y * height);

      if (op.points.length === 1) {
        ctx.lineTo(first.x * width, first.y * height);
      } else if (op.points.length === 2) {
        ctx.lineTo(op.points[1].x * width, op.points[1].y * height);
      } else {
        let i;
        for (i = 1; i < op.points.length - 2; i++) {
          const c = (op.points[i].x * width + op.points[i + 1].x * width) / 2;
          const d = (op.points[i].y * height + op.points[i + 1].y * height) / 2;
          ctx.quadraticCurveTo(op.points[i].x * width, op.points[i].y * height, c, d);
        }
        ctx.quadraticCurveTo(
          op.points[i].x * width,
          op.points[i].y * height,
          op.points[i + 1].x * width,
          op.points[i + 1].y * height
        );
      }
      ctx.stroke();
    }

    if (op.type === 'fill') {
      ctx.globalCompositeOperation = 'source-over';
      const imageData = ctx.getImageData(0, 0, width, height);
      const startX = Math.floor(op.x * width);
      const startY = Math.floor(op.y * height);
      
      const newImageData = floodFill(imageData, startX, startY, op.color);
      if (newImageData) {
        ctx.putImageData(newImageData, 0, 0);
      }
    }
  }
  
  ctx.globalCompositeOperation = 'source-over';
};
