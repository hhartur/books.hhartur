// Se já logado, redireciona
if (Auth.isLoggedIn()) window.location.href = '/books.html';

const form = document.getElementById('loginForm');
const alertEl = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const togglePwd = document.getElementById('togglePwd');
const pwdInput = document.getElementById('password');

togglePwd.addEventListener('click', () => {
    pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
});

function showError(msg) {
    alertEl.textContent = msg;
    alertEl.classList.remove('hidden');
}

function setLoading(v) {
    submitBtn.disabled = v;
    btnText.classList.toggle('hidden', v);
    btnSpinner.classList.toggle('hidden', !v);
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertEl.classList.add('hidden');
    setLoading(true);

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const data = await api.login(username, password);
        if (data.error) { showError(data.error); return; }
        Auth.setTokens(data.accessToken, data.refreshToken, data.user);
        window.location.href = '/books.html';
    } catch {
        showError('Erro de conexão. Verifique sua internet.');
    } finally {
        setLoading(false);
    }
});