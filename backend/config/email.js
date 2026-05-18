const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Ujian Online'}" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

const sendPasswordResetEmail = async (to, resetToken, userName) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Reset Password</h2>
      <p>Halo ${userName},</p>
      <p>Anda menerima email ini karena ada permintaan reset password untuk akun Anda.</p>
      <p>Klik tombol di bawah untuk reset password:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      </div>
      <p>Atau copy dan paste link berikut ke browser Anda:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p>Link ini akan kadaluarsa dalam 1 jam.</p>
      <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
    </div>
  `;
  return sendEmail(to, 'Reset Password - Ujian Online', html);
};

const sendExamNotification = async (to, examTitle, startDate, endDate, userName) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Ujian Baru Tersedia</h2>
      <p>Halo ${userName},</p>
      <p>Ada ujian baru yang tersedia untuk Anda:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">${examTitle}</h3>
        <p><strong>Waktu Mulai:</strong> ${new Date(startDate).toLocaleString('id-ID')}</p>
        <p><strong>Waktu Selesai:</strong> ${new Date(endDate).toLocaleString('id-ID')}</p>
      </div>
      <p>Login ke sistem untuk mengakses ujian:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Login Sekarang</a>
      </div>
      <p>Pastikan Anda mengerjakan ujian sesuai waktu yang ditentukan.</p>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
    </div>
  `;
  return sendEmail(to, `Ujian Baru: ${examTitle}`, html);
};

const sendExamResultNotification = async (to, examTitle, score, correct, total, userName, hasEssay = false) => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hasil Ujian</h2>
      <p>Halo ${userName},</p>
      <p>Hasil ujian Anda telah tersedia:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">${examTitle}</h3>
        ${hasEssay 
          ? `<p style="font-size: 18px; color: #FF9800;">📝 Ujian mengandung soal essay yang memerlukan pemeriksaan manual oleh guru.</p>
             <p style="font-size: 14px; color: #666;">Nilai sementara Anda akan ditampilkan setelah soal pilihan ganda dinilai. Nilai final akan tersedia setelah guru memeriksa essay.</p>`
          : `<p style="font-size: 24px; font-weight: bold; color: ${score >= 70 ? '#4CAF50' : '#F44336'}; margin: 10px 0;">${score?.toFixed(2) || '0'}</p>
             <p><strong>Jawaban Benar:</strong> ${correct || 0} dari ${total || 0} soal</p>`
        }
      </div>
      <p>Login ke sistem untuk melihat detail hasil ujian:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/results" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Lihat Detail</a>
      </div>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
    </div>
  `;
  return sendEmail(to, `Hasil Ujian: ${examTitle}`, html);
};

const sendEssayGradedNotification = async (to, examTitle, finalScore, essayScore, userName) => {
  // Ensure numeric values are numbers
  const finalScoreNum = parseFloat(finalScore) || 0;
  const essayScoreNum = parseFloat(essayScore) || 0;
  const autoScoreNum = finalScoreNum - essayScoreNum;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>📝 Nilai Essay Telah Tersedia</h2>
      <p>Halo ${userName},</p>
      <p>Guru telah selesai memeriksa jawaban essay Anda untuk ujian:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">${examTitle}</h3>
        <table style="width: 100%; margin: 15px 0;">
          <tr>
            <td style="padding: 10px; background-color: #e3f2fd; border-radius: 4px;">
              <strong>Nilai Pilihan Ganda:</strong>
            </td>
            <td style="padding: 10px; text-align: right; background-color: #e3f2fd; border-radius: 4px;">
              ${autoScoreNum.toFixed(2)} poin
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; background-color: #f3e5f5; border-radius: 4px;">
              <strong>Nilai Essay:</strong>
            </td>
            <td style="padding: 10px; text-align: right; background-color: #f3e5f5; border-radius: 4px;">
              ${essayScoreNum.toFixed(2)} poin
            </td>
          </tr>
          <tr>
            <td style="padding: 10px; background-color: #fff3e0; border-radius: 4px; font-weight: bold;">
              <strong>Nilai Final:</strong>
            </td>
            <td style="padding: 10px; text-align: right; background-color: #fff3e0; border-radius: 4px; font-size: 20px; font-weight: bold; color: ${finalScoreNum >= 70 ? '#4CAF50' : '#F44336'};">
              ${finalScoreNum.toFixed(2)}
            </td>
          </tr>
        </table>
      </div>
      <p>Login ke sistem untuk melihat detail penilaian dan catatan dari guru:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/results" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Lihat Detail Penilaian</a>
      </div>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
    </div>
  `;
  return sendEmail(to, `Nilai Essay Tersedia: ${examTitle}`, html);
};

const sendResetRequestStatusEmail = async (to, examTitle, status, userName) => {
  const statusText = status === 'approved' ? 'Disetujui' : 'Ditolak';
  const statusColor = status === 'approved' ? '#4CAF50' : '#F44336';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Status Permintaan Reset Ujian</h2>
      <p>Halo ${userName},</p>
      <p>Permintaan reset ujian Anda telah <strong style="color: ${statusColor};">${statusText}</strong>:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">${examTitle}</h3>
        <p style="font-size: 18px; font-weight: bold; color: ${statusColor};">${statusText}</p>
      </div>
      ${status === 'approved' ? '<p>Anda sekarang dapat mengerjakan ulang ujian ini.</p>' : '<p>Silakan hubungi admin/guru untuk informasi lebih lanjut.</p>'}
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/exams" style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Lihat Ujian</a>
      </div>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
      <p style="color: #999; font-size: 12px;">Email ini dikirim otomatis, mohon tidak membalas email ini.</p>
    </div>
  `;
  return sendEmail(to, `Status Reset Ujian: ${examTitle}`, html);
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendExamNotification,
  sendExamResultNotification,
  sendEssayGradedNotification,
  sendResetRequestStatusEmail
};
