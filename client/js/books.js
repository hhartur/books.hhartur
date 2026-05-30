if (!requireAuth()) throw new Error('not auth');

const user = Auth.getUser();
document.getElementById('navUsername').textContent = user.username;
if (['global', 'admin', 'editor'].includes(user.role)) {
    document.getElementById('adminLink').classList.remove('hidden');
}

document.getElementById('logoutBtn').addEventListener('click', () => api.logout());

// State
let currentPage = 1;
let searchTerm = '';
let searchTimer = null;
const LIMIT = 24;

const loadingEl = document.getElementById('loadingState');
const emptyEl   = document.getElementById('emptyState');
const gridEl    = document.getElementById('booksGrid');
const pagEl     = document.getElementById('pagination');
const countEl   = document.getElementById('countLabel');
const pageInfoEl = document.getElementById('pageInfo');
const pageBtns  = document.getElementById('pageButtons');

// ─── Skeleton cards enquanto carrega ─────────────────────────
function renderSkeletons(count = 8) {
    gridEl.innerHTML = Array.from({ length: count }).map(() => `
        <div class="book-card book-card--skeleton">
            <div class="book-cover skeleton-cover"></div>
            <div class="book-info">
                <div class="skeleton-line skeleton-line--title"></div>
                <div class="skeleton-line skeleton-line--author"></div>
            </div>
            <div class="book-actions">
                <div class="skeleton-btn"></div>
                <div class="skeleton-btn"></div>
            </div>
        </div>
    `).join('');
    gridEl.classList.remove('hidden');
}

function bookIcon(size = 48) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>`;
}

function renderBooks(books) {
    gridEl.innerHTML = '';

    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';

        // Monta cover separado via DOM
        const coverEl = document.createElement('div');
        coverEl.className = 'book-cover';

        if (book.cover_url) {
            const img = document.createElement('img');
            img.src = book.cover_url;
            img.alt = book.title;
            img.loading = 'lazy';
            img.addEventListener('error', () => {
                coverEl.innerHTML = bookIcon();
            });
            coverEl.appendChild(img);
        } else {
            coverEl.innerHTML = bookIcon();
        }

        card.appendChild(coverEl);

        card.innerHTML += `
          <div class="book-info">
            <div class="book-title">${escHtml(book.title)}</div>
            ${book.author ? `<div class="book-author">${escHtml(book.author)}</div>` : ''}
          </div>
          <div class="book-actions">
            <button class="btn btn-ghost btn-sm flex-1 js-read">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              Ler
            </button>
            <button class="btn btn-ghost btn-sm flex-1 js-download">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Baixar
            </button>
          </div>
        `;

        card.querySelector('.js-read').addEventListener('click', () => openBook(book, 'read'));
        card.querySelector('.js-download').addEventListener('click', () => openBook(book, 'download'));

        gridEl.appendChild(card);
    });
}

// Abre livro — reutiliza dados já carregados da listagem (evita chamada extra)
async function openBook(book, action) {
    try {
        const { url, error } = await api.getSecureUrl(book.id);
        if (error) { alert('Erro ao abrir livro: ' + error); return; }

        if (action === 'read') {
            const params = new URLSearchParams({ url, title: book.title });
            window.location.href = `/reader.html?${params}`;
        } else {
            const a = document.createElement('a');
            a.href = url;
            a.download = (book.title || 'livro') + '.pdf';
            a.click();
        }
    } catch {
        alert('Erro de conexão.');
    }
}

function renderPagination(total, page) {
    const totalPages = Math.ceil(total / LIMIT);
    pageInfoEl.textContent = `${((page - 1) * LIMIT) + 1}–${Math.min(page * LIMIT, total)} de ${total}`;
    pageBtns.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '←';
    prev.disabled = page <= 1;
    prev.addEventListener('click', () => { currentPage--; loadBooks(); });
    pageBtns.appendChild(prev);

    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === page ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', (() => { const p = i; return () => { currentPage = p; loadBooks(); }; })());
        pageBtns.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = '→';
    next.disabled = page >= totalPages;
    next.addEventListener('click', () => { currentPage++; loadBooks(); });
    pageBtns.appendChild(next);
}

async function loadBooks() {
    // Mostra skeletons imediatamente
    renderSkeletons();
    loadingEl.classList.add('hidden');
    emptyEl.classList.add('hidden');
    pagEl.classList.add('hidden');

    try {
        const params = { page: currentPage, limit: LIMIT };
        if (searchTerm) params.search = searchTerm;
        const { books, total, error } = await api.getBooks(params);

        if (error) throw new Error(error);

        countEl.textContent = `${total} livro${total !== 1 ? 's' : ''} disponível${total !== 1 ? 'is' : ''}`;

        if (!books || books.length === 0) {
            gridEl.classList.add('hidden');
            document.getElementById('emptyMsg').textContent = searchTerm
                ? `Nenhum livro encontrado para "${searchTerm}".`
                : 'Nenhum livro disponível ainda.';
            emptyEl.classList.remove('hidden');
        } else {
            renderBooks(books);
            gridEl.classList.remove('hidden');
            if (total > LIMIT) {
                renderPagination(total, currentPage);
                pagEl.classList.remove('hidden');
            }
        }
    } catch {
        gridEl.classList.add('hidden');
        countEl.textContent = '';
        document.getElementById('emptyMsg').textContent = 'Erro ao carregar livros.';
        emptyEl.classList.remove('hidden');
    }
}

document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        searchTerm = e.target.value.trim();
        currentPage = 1;
        loadBooks();
    }, 400);
});

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

loadBooks();
