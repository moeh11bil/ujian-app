/**
 * PDF Generation Utilities for Exam Cards
 * Layout: 6 cards per A4 page (2 columns x 3 rows)
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fsSync = require('fs');

const LOGO_PATH = path.join(__dirname, '../uploads/logo.png');
const HAS_LOGO = fsSync.existsSync(LOGO_PATH);

function generateExamCardsPDF(students, exams, options = {}) {
  const {
    includePassword = true
  } = options;

  const margin = 20;
  const cardWidth = 270;
  const cardHeight = 210;
  const cardGapX = 15;
  const cardGapY = 15;
  const cardsPerRow = 2;
  const cardsPerCol = 3;
  const cardsPerPage = cardsPerRow * cardsPerCol;

  const doc = new PDFDocument({ size: 'A4', margin: margin });

  students.forEach((student, index) => {
    if (index > 0 && index % cardsPerPage === 0) doc.addPage();
    const col = index % cardsPerRow;
    const row = Math.floor((index % cardsPerPage) / cardsPerRow);
    const x = margin + col * (cardWidth + cardGapX);
    const y = margin + row * (cardHeight + cardGapY);
    drawExamCard(doc, x, y, cardWidth, cardHeight, student, includePassword);
  });

  return doc;
}

function drawExamCard(doc, x, y, width, height, student, includePassword) {
  doc.save();
  
  // Outer Box (Garis Kotak Pembatas)
  doc.rect(x, y, width, height).strokeColor('#1e3a8a').lineWidth(1.5).stroke();
  
  // Header (Blue primary)
  doc.rect(x, y, width, 45).fill('#00236f');
  if (HAS_LOGO) doc.image(LOGO_PATH, x + 5, y + 5, { width: 35 });
  
  doc.fillColor('#ffffff');
  doc.font('Helvetica-Bold').fontSize(11).text('MADRASAH ALIYAH AL-IKHLAS', x + (HAS_LOGO ? 45 : 10), y + 10, { width: width - (HAS_LOGO ? 50 : 20), align: 'center' });
  doc.font('Helvetica').fontSize(8).text('KARTU TANDA PESERTA UJIAN', x + (HAS_LOGO ? 45 : 10), y + 25, { width: width - (HAS_LOGO ? 50 : 20), align: 'center' });

  // Photo Box (Left)
  const photoSize = 70;
  const photoX = x + 10;
  const photoY = y + 55;
  doc.rect(photoX, photoY, photoSize, photoSize).fill('#f3f4f6').strokeColor('#00236f').lineWidth(1).stroke();
  
  // Placeholder manusia sederhana (menggunakan garis)
  doc.strokeColor('#9ca3af').lineWidth(1.5)
     .circle(photoX + photoSize / 2, photoY + 25, 12).stroke() // kepala
     .moveTo(photoX + photoSize / 2 - 20, photoY + photoSize - 5)
     .lineTo(photoX + photoSize / 2 + 20, photoY + photoSize - 5)
     .moveTo(photoX + photoSize / 2, photoY + 25 + 12)
     .lineTo(photoX + photoSize / 2, photoY + photoSize - 5)
     .stroke();

  // Details (Right)
  const detailsX = x + 90;
  doc.fillColor('#1f2937');
  doc.font('Helvetica-Bold').fontSize(9).text('Nama:', detailsX, y + 55);
  doc.font('Helvetica').fontSize(9).text(student.nama || '-', detailsX, y + 65, { width: width - 100 });
  
  doc.font('Helvetica-Bold').fontSize(9).text('NISN:', detailsX, y + 80);
  doc.font('Helvetica').fontSize(9).text(student.nisn || '-', detailsX, y + 90);
  
  doc.font('Helvetica-Bold').fontSize(9).text('Kelas:', detailsX, y + 105);
  doc.font('Helvetica').fontSize(9).text(student.nama_kelas || '-', detailsX, y + 115);

  // Registration Number & Token
  const leftX = x + 10;
  const rightX = x + width - 130;
  const alignY = y + 135;

  // Baris 1: Nomor Peserta (kiri) sejajar dengan 'Kepala Madrasah,' (kanan)
  doc.fillColor('#00236f').font('Helvetica-Bold').fontSize(7).text('NOMOR PESERTA', leftX, alignY);
  doc.fillColor('#111827').fontSize(11).text(student.no_peserta || `01-${student.id || '000'}`, leftX, alignY + 10);

  doc.fillColor('#1f2937').fontSize(8).font('Helvetica').text('Kepala Madrasah,', rightX, alignY);

  // Baris 2: Token (kiri) sejajar dengan nama kepala madrasah (kanan)
  const tokenText = `KATA SANDI UJIAN: ${student.password_display || 'N/A'}`;
  doc.fillColor('#fff7ed').rect(leftX, alignY + 30, 110, 16).fill();
  doc.strokeColor('#f59e0b').lineWidth(0.5).rect(leftX, alignY + 30, 110, 16).stroke();
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(7).text(tokenText, leftX + 2, alignY + 34);

  doc.fontSize(8).font('Helvetica-Bold').text('DEDEN RAHMAT YUSUF, S.Pd.I', rightX, alignY + 36);

  // Footer / Catatan Ujian (Bagian bawah)
  doc.fillColor('#6b7280').fontSize(6).font('Helvetica-Oblique')
     .text('Catatan: Kartu ini wajib dibawa saat ujian berlangsung.', x + 10, y + height - 15, { width: width - 20, align: 'center' });
  
  doc.restore();
}

module.exports = { generateExamCardsPDF };
