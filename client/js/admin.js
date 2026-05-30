// Guard: apenas editor, admin, global
if (!requireRole('global', 'admin', 'editor')) throw new Error('forbidden');

const user = Auth.getUser();
document.getElementById('navUsername').textContent = user.username;

// Oculta opção admin se não for global
if (user.role !== 'global') {
    document.getElementById('adminOption').style.display = 'none';
}
// Oculta menu usuários para editor
if (user.role === 'editor') {
    document.getElementById('usersMenuBtn').style.display = 'none';
}

// ─── Section switcher ────────────────────────────────────────
function switchSection(name, btn) {
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('section-books').classList.toggle('hidden', name !== 'books');
    document.getElementById('section-users').classList.toggle('hidden', name !== 'users');
    if (name === 'users') loadUsers();
    if (name === 'books') loadBooks();
}

// ─── Modal helpers ───────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target === el) el.classList.remove('open'); });
});

// Close via [data-close] buttons
document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

function showAlert(elId, msg, type = 'error') {
    const el = document.getElementById(elId);
    el.className = `alert alert-${type}`;
    el.textContent = msg;
    el.classList.remove('hidden');
    if (type === 'success') setTimeout(() => el.classList.add('hidden'), 3000);
}

function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── BOOKS ───────────────────────────────────────────────────
let editingBookId = null;
let booksPage = 1;
let booksSearch = '';
let booksSearchTimer;
const BOOKS_LIMIT = 15;

document.getElementById('bookSearch').addEventListener('input', (e) => {
    clearTimeout(booksSearchTimer);
    booksSearchTimer = setTimeout(() => {
        booksSearch = e.target.value.trim();
        booksPage = 1;
        loadBooks();
    }, 400);
});

async function loadBooks() {
    const tbody = document.getElementById('booksTableBody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-3);"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;
    document.getElementById('booksPagination').classList.add('hidden');

    try {
        const params = { page: booksPage, limit: BOOKS_LIMIT };
        if (booksSearch) params.search = booksSearch;
        const { books, total, error } = await api.getBooks(params);
        if (error) throw new Error(error);

        if (!books || books.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-3);">Nenhum livro encontrado.</td></tr>`;
            return;
        }

        const canDelete = ['global', 'admin'].includes(user.role);

        tbody.innerHTML = books.map(b => `
        <tr>
          <td><span style="font-weight:500;">${escHtml(b.title)}</span></td>
          <td class="text-muted">${escHtml(b.author || '—')}</td>
          <td class="text-muted">${formatDate(b.created_at)}</td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm js-edit-book"
                data-id="${escHtml(b.id)}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </button>
              ${canDelete ? `
              <button class="btn btn-danger btn-sm js-delete-book"
                data-id="${escHtml(b.id)}"
                data-title="${escHtml(b.title)}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');

        // Event delegation for book actions
        tbody.querySelectorAll('.js-edit-book').forEach(btn => {
            btn.addEventListener('click', () => editBook(btn.dataset.id));
        });
        tbody.querySelectorAll('.js-delete-book').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteBook(btn.dataset.id, btn.dataset.title));
        });

        if (total > BOOKS_LIMIT) {
            renderBooksPagination(total, booksPage);
            document.getElementById('booksPagination').classList.remove('hidden');
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--danger);">Erro ao carregar livros.</td></tr>`;
    }
}

function renderBooksPagination(total, page) {
    const totalPages = Math.ceil(total / BOOKS_LIMIT);
    document.getElementById('booksPageInfo').textContent = `Página ${page} de ${totalPages} (${total} livros)`;
    const btns = document.getElementById('booksPageBtns');
    btns.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn'; prev.textContent = '←'; prev.disabled = page <= 1;
    prev.addEventListener('click', () => { booksPage--; loadBooks(); });
    btns.appendChild(prev);

    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === page ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', (() => { const p = i; return () => { booksPage = p; loadBooks(); }; })());
        btns.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn'; next.textContent = '→'; next.disabled = page >= totalPages;
    next.addEventListener('click', () => { booksPage++; loadBooks(); });
    btns.appendChild(next);
}

function openBookModal() {
    editingBookId = null;
    document.getElementById('bookModalTitle').textContent = 'Adicionar livro';
    document.getElementById('bookTitle').value = '';
    document.getElementById('bookAuthor').value = '';
    document.getElementById('bookDesc').value = '';
    document.getElementById('pdfInput').value = '';
    document.getElementById('fileDropText').textContent = 'Clique para selecionar PDF';
    document.getElementById('pdfUploadGroup').style.display = '';
    document.getElementById('bookModalAlert').classList.add('hidden');
    fileDrop.classList.remove('drag-over');
    openModal('bookModal');
}

async function editBook(id) {
    const { book, error } = await api.getBook(id);
    if (error) { alert('Erro: ' + error); return; }
    editingBookId = id;
    document.getElementById('bookModalTitle').textContent = 'Editar livro';
    document.getElementById('bookTitle').value = book.title || '';
    document.getElementById('bookAuthor').value = book.author || '';
    document.getElementById('bookDesc').value = book.description || '';
    document.getElementById('fileDropText').textContent = 'Selecionar novo PDF (opcional)';
    document.getElementById('bookModalAlert').classList.add('hidden');
    openModal('bookModal');
}

// File drop
const fileDrop = document.getElementById('fileDrop');
const pdfInput = document.getElementById('pdfInput');

fileDrop.addEventListener('click', () => pdfInput.click());

pdfInput.addEventListener('change', () => {
    if (pdfInput.files[0]) {
        document.getElementById('fileDropText').textContent = pdfInput.files[0].name;
        fileDrop.classList.add('drag-over');
    }
});
fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('drag-over'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag-over'));
fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        const dt = new DataTransfer();
        dt.items.add(file);
        pdfInput.files = dt.files;
        document.getElementById('fileDropText').textContent = file.name;
    }
});

async function saveBook() {
    const title = document.getElementById('bookTitle').value.trim();
    const file = pdfInput.files[0];

    if (!title) { showAlert('bookModalAlert', 'Título é obrigatório.'); return; }
    if (!editingBookId && !file) { showAlert('bookModalAlert', 'Selecione um arquivo PDF.'); return; }

    const btn = document.getElementById('bookSaveBtn');
    const txt = document.getElementById('bookSaveTxt');
    const spin = document.getElementById('bookSaveSpinner');
    btn.disabled = true; txt.classList.add('hidden'); spin.classList.remove('hidden');
    document.getElementById('bookModalAlert').classList.add('hidden');

    try {
        const fd = new FormData();
        fd.append('title', title);
        fd.append('author', document.getElementById('bookAuthor').value.trim());
        fd.append('description', document.getElementById('bookDesc').value.trim());
        if (file) fd.append('pdf', file);

        const data = editingBookId
            ? await api.updateBook(editingBookId, fd)
            : await api.createBook(fd);

        if (data.error) { showAlert('bookModalAlert', data.error); return; }

        closeModal('bookModal');
        showAlert('booksAlert', editingBookId ? 'Livro atualizado.' : 'Livro adicionado.', 'success');
        loadBooks();
    } catch {
        showAlert('bookModalAlert', 'Erro de conexão.');
    } finally {
        btn.disabled = false; txt.classList.remove('hidden'); spin.classList.add('hidden');
    }
}

function confirmDeleteBook(id, title) {
    document.getElementById('confirmMsg').textContent = `Remover "${title}"? Esta ação não pode ser desfeita.`;
    const okBtn = document.getElementById('confirmOkBtn');
    // Clone to remove any previous listener
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    newOkBtn.addEventListener('click', async () => {
        const { error } = await api.deleteBook(id);
        closeModal('confirmModal');
        if (error) { showAlert('booksAlert', error); return; }
        showAlert('booksAlert', 'Livro removido.', 'success');
        loadBooks();
    });
    openModal('confirmModal');
}

// ─── USERS ───────────────────────────────────────────────────
let editingUserId = null;

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3);"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;

    try {
        const { users, error } = await api.getUsers();
        if (error) throw new Error(error);
        if (!users || users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3);">Nenhum usuário encontrado.</td></tr>`;
            return;
        }

        const canDeleteUsers = user.role === 'global';

        tbody.innerHTML = users.map(u => `
        <tr>
          <td class="mono" style="font-size:.85rem;">${escHtml(u.username)}</td>
          <td><span class="badge badge-${u.role}">${u.role}</span></td>
          <td><span class="badge ${u.active ? 'badge-active' : 'badge-inactive'}">${u.active ? 'ativo' : 'inativo'}</span></td>
          <td class="text-muted">${formatDate(u.created_at)}</td>
          <td class="text-muted">${formatDate(u.last_login)}</td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm js-edit-user"
                data-id="${escHtml(u.id)}"
                data-username="${escHtml(u.username)}"
                data-role="${escHtml(u.role)}"
                data-active="${u.active}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Editar
              </button>
              ${canDeleteUsers && u.role !== 'global' ? `
              <button class="btn btn-danger btn-sm js-delete-user"
                data-id="${escHtml(u.id)}"
                data-username="${escHtml(u.username)}">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');

        // Event delegation for user actions
        tbody.querySelectorAll('.js-edit-user').forEach(btn => {
            btn.addEventListener('click', () => {
                editUser(btn.dataset.id, btn.dataset.username, btn.dataset.role, btn.dataset.active === 'true');
            });
        });
        tbody.querySelectorAll('.js-delete-user').forEach(btn => {
            btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id, btn.dataset.username));
        });

    } catch {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--danger);">Erro ao carregar usuários.</td></tr>`;
    }
}

function openUserModal() {
    editingUserId = null;
    document.getElementById('userModalTitle').textContent = 'Novo usuário';
    document.getElementById('userUsername').value = '';
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = 'reader';
    document.getElementById('userUsername').disabled = false;
    document.getElementById('userSaveTxt').textContent = 'Criar';
    document.getElementById('userModalAlert').classList.add('hidden');
    openModal('userModal');
}

function editUser(id, username, role, active) {
    editingUserId = id;
    document.getElementById('userModalTitle').textContent = 'Editar usuário';
    document.getElementById('userUsername').value = username;
    document.getElementById('userUsername').disabled = true;
    document.getElementById('userPassword').value = '';
    document.getElementById('userRole').value = role;
    document.getElementById('userSaveTxt').textContent = 'Salvar';
    document.getElementById('userModalAlert').classList.add('hidden');
    openModal('userModal');
}

async function saveUser() {
    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;

    const btn = document.getElementById('userSaveBtn');
    const txt = document.getElementById('userSaveTxt');
    const spin = document.getElementById('userSaveSpinner');
    btn.disabled = true; txt.classList.add('hidden'); spin.classList.remove('hidden');
    document.getElementById('userModalAlert').classList.add('hidden');

    try {
        let data;
        if (editingUserId) {
            const payload = { role };
            if (password) payload.password = password;
            data = await api.updateUser(editingUserId, payload);
        } else {
            if (!username || !password) { showAlert('userModalAlert', 'Preencha todos os campos.'); return; }
            data = await api.createUser({ username, password, role });
        }

        if (data.error) { showAlert('userModalAlert', data.error); return; }

        closeModal('userModal');
        showAlert('usersAlert', editingUserId ? 'Usuário atualizado.' : 'Usuário criado.', 'success');
        loadUsers();
    } catch {
        showAlert('userModalAlert', 'Erro de conexão.');
    } finally {
        btn.disabled = false; txt.classList.remove('hidden'); spin.classList.add('hidden');
    }
}

function confirmDeleteUser(id, username) {
    document.getElementById('confirmMsg').textContent = `Remover o usuário "${username}"? Todos os tokens serão revogados.`;
    const okBtn = document.getElementById('confirmOkBtn');
    // Clone to remove any previous listener
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    newOkBtn.addEventListener('click', async () => {
        const { error } = await api.deleteUser(id);
        closeModal('confirmModal');
        if (error) { showAlert('usersAlert', error); return; }
        showAlert('usersAlert', 'Usuário removido.', 'success');
        loadUsers();
    });
    openModal('confirmModal');
}

// ─── Init ────────────────────────────────────────────────────
loadBooks();

// ─── Sidebar navigation ──────────────────────────────────────
document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section, btn));
});

// ─── Open modals ─────────────────────────────────────────────
document.getElementById('addBookBtn').addEventListener('click', openBookModal);
document.getElementById('addUserBtn').addEventListener('click', openUserModal);

// ─── Save actions ─────────────────────────────────────────────
document.getElementById('bookSaveBtn').addEventListener('click', saveBook);
document.getElementById('userSaveBtn').addEventListener('click', saveUser);

// ─── Logout ──────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', () => api.logout());
