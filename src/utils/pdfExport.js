import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportToPDF(printRef, city, totalDays) {
  const el = printRef.current;
  if (!el) throw new Error('Print element not found');

  // Temporarily move on-screen so html2canvas can measure it correctly
  const prev = { position: el.style.position, left: el.style.left, top: el.style.top };
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';

  let canvas;
  try {
    canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      width: el.offsetWidth,
      height: el.scrollHeight,
      windowWidth: el.offsetWidth,
    });
  } finally {
    el.style.position = prev.position;
    el.style.left = prev.left;
    el.style.top = prev.top;
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const pageH = 297;
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let remaining = imgH;
  let srcY = 0;

  while (remaining > 0) {
    const sliceH = Math.min(pageH, remaining);
    const sliceCanvas = document.createElement('canvas');
    const srcSliceH = (sliceH / imgW) * canvas.width;

    sliceCanvas.width = canvas.width;
    sliceCanvas.height = srcSliceH;
    const ctx = sliceCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, srcY, canvas.width, srcSliceH, 0, 0, canvas.width, srcSliceH);

    if (srcY > 0) pdf.addPage();
    pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, sliceH);

    srcY += srcSliceH;
    remaining -= sliceH;
  }

  const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);
  pdf.save(`${cityLabel}-${totalDays}-day-itinerary.pdf`);
}
