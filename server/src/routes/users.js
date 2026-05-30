const express = require('express');
const router = express.Router();
const { authenticate, requireGlobal, requireAdmin } = require('../middleware/auth');
const { listUsers, createUser, updateUser, deleteUser } = require('../controllers/usersController');

// Todas as rotas exigem autenticação
router.use(authenticate);

// Listar — global e admin
router.get('/', requireAdmin, listUsers);

// Criar — global e admin (com restrição interna de roles)
router.post('/', requireAdmin, createUser);

// Atualizar — global e admin
router.put('/:id', requireAdmin, updateUser);

// Deletar — apenas global
router.delete('/:id', requireGlobal, deleteUser);

module.exports = router;
