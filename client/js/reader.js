if (!requireAuth()) throw new Error('not auth');

const params = new URLSearchParams(window.location.search);
const url = params.get('url');
const title = params.get('title') || 'Livro';

if (!url) {
    document.getElementById('errorState').classList.remove('hidden');
    document.getElementById('pdfFrame').style.display = 'none';
} else {
    document.getElementById('pdfTitle').textContent = title;
    document.title = `books.hhartur — ${title}`;
    document.getElementById('pdfFrame').src = url;
    document.getElementById('downloadBtn').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = title + '.pdf';
        a.click();
    });
}
