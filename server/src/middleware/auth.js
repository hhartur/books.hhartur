const { verifyAccessToken } = require('../config/jwt');

const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
};

// Apenas global (hhartur)
const requireGlobal = (req, res, next) => {
  if (req.user.role !== 'global') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador global.' });
  }
  next();
};

// Global ou admin
const requireAdmin = (req, res, next) => {
  if (!['global', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }
  next();
};

// Global, admin ou editor
const requireEditor = (req, res, next) => {
  if (!['global', 'admin', 'editor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso restrito a editores ou superior.' });
  }
  next();
};

// Qualquer usuário autenticado
const requireReader = (req, res, next) => {
  if (!['global', 'admin', 'editor', 'reader'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acesso negado.' });
  }
  next();
};

module.exports = { authenticate, requireGlobal, requireAdmin, requireEditor, requireReader };
