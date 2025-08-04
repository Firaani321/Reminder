const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Izinkan koneksi dari mana saja
  }
});

// Gunakan port dari environment variable, atau 3000 jika tidak ada
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>WhatsApp Server Aktif!</h1>');
});

const client = new Client({
  authStrategy: new LocalAuth({
    // Path ini penting, akan kita atur di Render
    dataPath: '/data/wwebjs_auth' 
  }),
  // Konfigurasi ini WAJIB untuk server Linux seperti Render
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- ini mungkin membantu di lingkungan memori rendah
      '--disable-gpu'
    ],
  },
});

client.initialize();

io.on('connection', (socket) => {
  console.log('User terhubung:', socket.id);

  client.on('qr', (qr) => {
    console.log('QR Diterima', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QR Code diterima, silakan scan...');
    });
  });

  client.on('ready', () => {
    console.log('WhatsApp siap!');
    socket.emit('ready', 'WhatsApp siap digunakan!');
    socket.emit('message', 'WhatsApp siap digunakan!');
  });

  client.on('authenticated', () => {
    console.log('Autentikasi berhasil!');
    socket.emit('authenticated', 'Autentikasi berhasil!');
    socket.emit('message', 'Autentikasi berhasil!');
  });

  client.on('auth_failure', (msg) => {
    console.error('Autentikasi Gagal!', msg);
    socket.emit('message', 'Autentikasi gagal, restart server...');
  });

  client.on('disconnected', (reason) => {
    socket.emit('message', 'Koneksi terputus!');
    client.destroy();
    client.initialize();
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
