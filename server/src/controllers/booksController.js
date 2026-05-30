const supabase = require('../config/supabase');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');

// Multer: armazena em memória para enviar ao Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos.'), false);
    }
  },
});

// Helper: gera URL de capa (thumbnail da 1ª página do PDF)
const getCoverUrl = (publicId) => {
  return cloudinary.url(publicId, {
    resource_type: 'image',
    format: 'jpg',
    transformation: [
      { width: 400, height: 600, crop: 'fill', gravity: 'north', page: 1 },
      { quality: 'auto', fetch_format: 'auto' },
    ],
    secure: true,
  });
};

// Helper: upload buffer ao Cloudinary
const uploadToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: 'books-hhartur',
        public_id: `${Date.now()}-${originalName.replace(/\s+/g, '_').replace(/\.pdf$/i, '')}`,
        format: 'pdf',
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// Cola isso num endpoint temporário de teste
const testUrl = async (req, res) => {
  const { data: book } = await supabase
    .from('books')
    .select('cloudinary_public_id')
    .limit(1)
    .single();

  console.log('public_id:', book.cloudinary_public_id);

  // Tenta os dois métodos
  const url1 = cloudinary.utils.private_download_url(
    book.cloudinary_public_id, 'pdf', { resource_type: 'image', expires_at: Math.floor(Date.now() / 1000) + 900 }
  );

  const url2 = cloudinary.url(book.cloudinary_public_id, {
    resource_type: 'image',
    format: 'pdf',
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 900,
    secure: true,
  });

  const url3 = cloudinary.url(book.cloudinary_public_id, {
    resource_type: 'image',
    type: 'authenticated',
    format: 'pdf',
    sign_url: true,
    secure: true,
  });

  return res.json({ public_id: book.cloudinary_public_id, url1, url2, url3 });
};

// Listar livros
const listBooks = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('books')
      .select('id, title, author, description, cloudinary_public_id, file_url, created_at, uploaded_by', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Gera cover_url dinamicamente para cada livro
    const books = (data || []).map(book => ({
      ...book,
      cover_url: book.cloudinary_public_id ? getCoverUrl(book.cloudinary_public_id) : null,
    }));

    return res.status(200).json({ books, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('listBooks error:', err);
    return res.status(500).json({ error: 'Erro ao listar livros.' });
  }
};

// Buscar livro por ID
const getBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Livro não encontrado.' });
    }

    const book = {
      ...data,
      cover_url: data.cloudinary_public_id ? getCoverUrl(data.cloudinary_public_id) : null,
    };

    return res.status(200).json({ book });
  } catch (err) {
    console.error('getBook error:', err);
    return res.status(500).json({ error: 'Erro ao buscar livro.' });
  }
};

// Criar livro (com upload PDF)
const createBook = async (req, res) => {
  try {
    const { title, author, description } = req.body;

    if (!title || !req.file) {
      return res.status(400).json({ error: 'Título e arquivo PDF são obrigatórios.' });
    }

    // Upload para Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    const { data: book, error } = await supabase
      .from('books')
      .insert({
        title: title.trim(),
        author: author ? author.trim() : null,
        description: description ? description.trim() : null,
        file_url: result.secure_url,
        cloudinary_public_id: result.public_id,
        uploaded_by: req.user.id,
      })
      .select('id, title, author, description, file_url, cloudinary_public_id, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({
      book: { ...book, cover_url: getCoverUrl(book.cloudinary_public_id) },
      message: 'Livro adicionado com sucesso.',
    });
  } catch (err) {
    console.error('createBook error:', err);
    return res.status(500).json({ error: 'Erro ao criar livro.' });
  }
};

// Atualizar metadados do livro
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, description } = req.body;

    const updates = {};
    if (title) updates.title = title.trim();
    if (author !== undefined) updates.author = author ? author.trim() : null;
    if (description !== undefined) updates.description = description ? description.trim() : null;

    // Se enviou novo PDF, re-upload
    if (req.file) {
      const { data: existing } = await supabase
        .from('books')
        .select('cloudinary_public_id')
        .eq('id', id)
        .single();

      if (existing?.cloudinary_public_id) {
        await cloudinary.uploader.destroy(existing.cloudinary_public_id, { resource_type: 'image' });
      }

      const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      updates.file_url = result.secure_url;
      updates.cloudinary_public_id = result.public_id;
    }

    const { data: book, error } = await supabase
      .from('books')
      .update(updates)
      .eq('id', id)
      .select('id, title, author, description, file_url, cloudinary_public_id, created_at')
      .single();

    if (error) throw error;

    return res.status(200).json({
      book: { ...book, cover_url: getCoverUrl(book.cloudinary_public_id) },
      message: 'Livro atualizado.',
    });
  } catch (err) {
    console.error('updateBook error:', err);
    return res.status(500).json({ error: 'Erro ao atualizar livro.' });
  }
};

// Deletar livro
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: book } = await supabase
      .from('books')
      .select('cloudinary_public_id')
      .eq('id', id)
      .single();

    if (!book) {
      return res.status(404).json({ error: 'Livro não encontrado.' });
    }

    if (book.cloudinary_public_id) {
      await cloudinary.uploader.destroy(book.cloudinary_public_id, { resource_type: 'image' });
    }

    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) throw error;

    return res.status(200).json({ message: 'Livro removido com sucesso.' });
  } catch (err) {
    console.error('deleteBook error:', err);
    return res.status(500).json({ error: 'Erro ao deletar livro.' });
  }
};

// Gera URL assinada temporária para leitura segura (15 min)
const getSecureUrl = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: book } = await supabase
      .from('books')
      .select('cloudinary_public_id, title')
      .eq('id', id)
      .single();

    if (!book) {
      return res.status(404).json({ error: 'Livro não encontrado.' });
    }

    const signedUrl = cloudinary.url(book.cloudinary_public_id, {
      resource_type: 'image',
      format: 'pdf',
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 900, // 15 min
      secure: true,
    });

    return res.status(200).json({ url: signedUrl, expires_in: null });
  } catch (err) {
    console.error('getSecureUrl error:', err);
    return res.status(500).json({ error: 'Erro ao gerar URL segura.' });
  }
};

module.exports = { listBooks, getBook, createBook, updateBook, deleteBook, getSecureUrl, upload };
