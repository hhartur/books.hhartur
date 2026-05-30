const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

const SALT_ROUNDS = 12;

// Listar usuários (global e admin veem todos, exceto senhas)
const listUsers = async (req, res) => {
  try {
    let query = supabase
      .from('users')
      .select('id, username, role, active, created_at, last_login, created_by')
      .order('created_at', { ascending: false });

    // Admin não vê o global
    if (req.user.role === 'admin') {
      query = query.neq('role', 'global');
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ users: data });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
};

// Criar usuário
const createUser = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Username, senha e role são obrigatórios.' });
    }

    const allowedRoles = ['admin', 'editor', 'reader'];

    // Apenas global pode criar admin
    if (role === 'admin' && req.user.role !== 'global') {
      return res.status(403).json({ error: 'Apenas o global pode criar administradores.' });
    }

    // Ninguém pode criar outro global
    if (role === 'global') {
      return res.status(403).json({ error: 'Não é possível criar outro usuário global.' });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Role inválido. Use: admin, editor ou reader.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const cleanUsername = username.toLowerCase().trim();

    // Verifica se já existe
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', cleanUsername)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Username já está em uso.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username: cleanUsername,
        password_hash,
        role,
        active: true,
        created_by: req.user.id,
      })
      .select('id, username, role, active, created_at')
      .single();

    if (error) throw error;

    return res.status(201).json({ user: newUser, message: 'Usuário criado com sucesso.' });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};

// Atualizar usuário (role, active, password)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, active, password } = req.body;

    // Busca o alvo
    const { data: target, error: fetchErr } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('id', id)
      .single();

    if (fetchErr || !target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Ninguém mexe no global exceto ele mesmo
    if (target.role === 'global' && req.user.role !== 'global') {
      return res.status(403).json({ error: 'Não é possível modificar o usuário global.' });
    }

    // Admin não pode promover a admin ou global
    if (req.user.role === 'admin' && role && ['admin', 'global'].includes(role)) {
      return res.status(403).json({ error: 'Admins não podem atribuir este role.' });
    }

    const updates = {};
    if (role && role !== 'global') updates.role = role;
    if (typeof active === 'boolean') updates.active = active;
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
      }
      updates.password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, username, role, active')
      .single();

    if (error) throw error;

    return res.status(200).json({ user: updated, message: 'Usuário atualizado.' });
  } catch (err) {
    console.error('updateUser error:', err);
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
};

// Deletar usuário — apenas global
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: target } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', id)
      .single();

    if (!target) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (target.role === 'global') {
      return res.status(403).json({ error: 'O usuário global não pode ser removido.' });
    }

    // Revoga todos os refresh tokens do usuário
    await supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', id);

    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;

    return res.status(200).json({ message: 'Usuário removido com sucesso.' });
  } catch (err) {
    console.error('deleteUser error:', err);
    return res.status(500).json({ error: 'Erro ao remover usuário.' });
  }
};

module.exports = { listUsers, createUser, updateUser, deleteUser };
