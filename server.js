const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { createClient } = require('@supabase/supabase-js');

// --- Konfigurasi Supabase ---
// Atur ini di Environment Variables pada Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);


// --- Strategi Penyimpanan Sesi di Supabase ---
class SupabaseAuthStore {
  async getSession() {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('session_data')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') { // Abaikan error jika baris tidak ditemukan
      throw new Error(error.message);
    }
    return data?.session_data || null;
  }

  async saveSession(session) {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .update({ session_data: session })
      .eq('id', 1);
    
    if (error) {
      throw new Error(error.message);
    }
  }

  async removeSession() {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .update({ session_data: null })
      .eq('id', 1);

    if (error) {
      throw new Error(error.message);
    }
  }
}

const store = new SupabaseAuthStore();
const authStrategy = new RemoteAuth({
  store: store,
  backupSyncIntervalMs: 300000 // Simpan sesi setiap 5 menit
});


// --- Inisialisasi Server dan WhatsApp Client ---
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('<h1>WhatsApp Server dengan Supabase Auth Aktif!</h1>');
});

const client = new Client({
  authStrategy: authStrategy,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
});

client.initialize();

// ... (sisa kode Socket.IO Anda tetap sama)
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
