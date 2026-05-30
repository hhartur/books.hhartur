const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../config/jwt');

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e senha são obrigatórios.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('active', true)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const payload = { id: user.id, username: user.username, role: user.role };
    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Salva refresh token no banco
    await supabase.from('refresh_tokens').insert({
      user_id: user.id,
      token: refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    // Atualiza last_login
    await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    return res.status(200).json({
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token não fornecido.' });
    }

    // Verifica assinatura
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado.' });
    }

    // Verifica se o token existe no banco e não foi revogado
    const { data: storedToken, error } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .eq('revoked', false)
      .single();

    if (error || !storedToken) {
      return res.status(401).json({ error: 'Refresh token revogado ou não encontrado.' });
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Refresh token expirado.' });
    }

    // Busca usuário atualizado
    const { data: user } = await supabase
      .from('users')
      .select('id, username, role, active')
      .eq('id', decoded.id)
      .single();

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuário inativo ou não encontrado.' });
    }

    // Rotação: revoga o token antigo
    await supabase.from('refresh_tokens').update({ revoked: true }).eq('id', storedToken.id);

    const payload = { id: user.id, username: user.username, role: user.role };
    const newAccessToken  = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    // Salva novo refresh token
    await supabase.from('refresh_tokens').insert({
      user_id: user.id,
      token: newRefreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    return res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await supabase.from('refresh_tokens').update({ revoked: true }).eq('token', refreshToken);
    }
    return res.status(200).json({ message: 'Logout realizado com sucesso.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};

module.exports = { login, refresh, logout };
