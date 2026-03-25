import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Garantir que a pasta de soundfonts existe
  const soundfontsDir = path.join(__dirname, 'public', 'soundfonts');
  if (!fs.existsSync(soundfontsDir)) {
    fs.mkdirSync(soundfontsDir, { recursive: true });
  }

  // Configuração do Multer para Upload
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, soundfontsDir);
    },
    filename: (req, file, cb) => {
      // Mantém o nome original ou limpa caracteres especiais
      const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
      cb(null, cleanName);
    }
  });

  const upload = multer({ storage });

  // Rota para listar soundfonts locais
  app.get('/api/soundfonts', (req, res) => {
    fs.readdir(soundfontsDir, (err, files) => {
      if (err) return res.status(500).json({ error: 'Erro ao ler pasta' });
      const sfFiles = files.filter(f => f.endsWith('.sf2'));
      res.json(sfFiles);
    });
  });

  // Rota para upload de soundfont
  app.post('/api/upload', upload.single('file'), (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ message: 'Upload concluído', filename: req.file.filename });
  });

  // Rota para deletar soundfont
  app.delete('/api/soundfonts/:name', (req, res) => {
    const filePath = path.join(soundfontsDir, req.params.name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'Arquivo removido' });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  });

  // Servir arquivos estáticos da pasta public
  app.use('/soundfonts', express.static(soundfontsDir));

  // Middleware do Vite para desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Evolution Play rodando em http://localhost:${PORT}`);
    console.log(`📁 Pasta de timbres: ${soundfontsDir}`);
  });
}

startServer();
