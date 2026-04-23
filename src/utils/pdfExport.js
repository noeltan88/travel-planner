import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportToPDF(elementRef, city, days) {
  const canvas = await html2canvas(elementRef.current, {
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
  });
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 210;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= 297;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= 297;
  }

  const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);
  pdf.save(`${cityLabel}-${days}-day-itinerary.pdf`);
}
