const express = require('express');
const router = express.Router();
const { authenticate, requireEditor, requireAdmin } = require('../middleware/auth');
const {
  listBooks, getBook, createBook, updateBook, deleteBook, getSecureUrl, upload
} = require('../controllers/booksController');

router.use(authenticate);

// Leitura — qualquer autenticado
router.get('/', listBooks);
router.get('/:id', getBook);
router.get('/:id/secure-url', getSecureUrl);

// Criar — editor ou superior
router.post('/', requireEditor, upload.single('pdf'), createBook);

// Atualizar — editor ou superior
router.put('/:id', requireEditor, upload.single('pdf'), updateBook);

// Deletar — admin ou superior
router.delete('/:id', requireAdmin, deleteBook);

module.exports = router;
