import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ScoreProject } from '../types/music';

export const exportToPDF = async (project: ScoreProject): Promise<void> => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const margin = 20;

  // Add title page
  pdf.setFontSize(24);
  pdf.text(project.title, pageWidth / 2, 50, { align: 'center' });
  
  pdf.setFontSize(12);
  pdf.text(`Created: ${project.createdAt.toLocaleDateString()}`, pageWidth / 2, 70, { align: 'center' });
  pdf.text(`Pages: ${project.pages.length}`, pageWidth / 2, 80, { align: 'center' });

  // Add each score page
  for (let i = 0; i < project.pages.length; i++) {
    const page = project.pages[i];
    
    if (i > 0) {
      pdf.addPage();
    } else {
      pdf.addPage();
    }

    // Add page title
    pdf.setFontSize(16);
    pdf.text(page.title, margin, 30);

    // Create a temporary canvas for the staff
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 800;
    canvas.height = 200;

    // Draw staff lines
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    for (let line = 0; line < 5; line++) {
      const y = 60 + line * 20;
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(750, y);
      ctx.stroke();
    }

    // Draw treble clef
    ctx.font = '48px serif';
    ctx.fillStyle = '#333';
    ctx.fillText('𝄞', 20, 100);

    // Draw notes
    ctx.font = '24px serif';
    page.notes.forEach(placedNote => {
      ctx.fillText(placedNote.note.symbol, placedNote.x - 12, placedNote.y + 8);
    });

    // Convert canvas to image and add to PDF
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    
    pdf.addImage(imgData, 'PNG', margin, 50, imgWidth, imgHeight);

    // Add page number
    pdf.setFontSize(10);
    pdf.text(`Page ${i + 1}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  }

  // Save the PDF
  pdf.save(`${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
};

export const exportCurrentPageToPDF = async (
  project: ScoreProject, 
  currentPageId: string
): Promise<void> => {
  const currentPage = project.pages.find(page => page.id === currentPageId);
  if (!currentPage) return;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 20;

  // Add title
  pdf.setFontSize(20);
  pdf.text(project.title, pageWidth / 2, 30, { align: 'center' });
  
  pdf.setFontSize(14);
  pdf.text(currentPage.title, pageWidth / 2, 45, { align: 'center' });

  // Create canvas for the staff
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 800;
  canvas.height = 200;

  // Draw staff
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  for (let line = 0; line < 5; line++) {
    const y = 60 + line * 20;
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(750, y);
    ctx.stroke();
  }

  // Draw treble clef
  ctx.font = '48px serif';
  ctx.fillStyle = '#333';
  ctx.fillText('𝄞', 20, 100);

  // Draw notes
  ctx.font = '24px serif';
  currentPage.notes.forEach(placedNote => {
    ctx.fillText(placedNote.note.symbol, placedNote.x - 12, placedNote.y + 8);
  });

  // Add to PDF
  const imgData = canvas.toDataURL('image/png');
  const imgWidth = pageWidth - 2 * margin;
  const imgHeight = (canvas.height / canvas.width) * imgWidth;
  
  pdf.addImage(imgData, 'PNG', margin, 60, imgWidth, imgHeight);

  pdf.save(`${currentPage.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
};