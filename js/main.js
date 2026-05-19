document.addEventListener('DOMContentLoaded', () => {
    const booksContainer = document.getElementById('books-container');
    const modal = document.getElementById('book-modal');
    const closeBtn = document.getElementById('close-modal');

    // Render book cards — front cover only via CSS class (cover-left / cover-right)
    booksData.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div class="card-img-wrapper">
                <img src="${book.image}" alt="${book.title}" class="cover-${book.frontCoverSide}">
                <div class="hover-overlay">
                    <button class="btn-icon" data-id="${book.id}">متابعة</button>
                </div>
            </div>
            <div class="card-content">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
                <div class="price-action">
                    <button class="btn-buy" data-id="${book.id}">متابعة</button>
                </div>
            </div>
        `;
        booksContainer.appendChild(card);
    });

    function openModal(bookId) {
        const book = booksData.find(b => b.id === bookId);
        if (!book) return;

        const isSingle = book.frontCoverSide === 'single';
        const frontClass = `cover-${book.frontCoverSide}`;
        const backClass  = isSingle ? '' : (book.frontCoverSide === 'left' ? 'cover-right' : 'cover-left');

        const frontImg = document.getElementById('modal-front-img');
        const backImg  = document.getElementById('modal-back-img');
        const backCover = backImg.closest('.modal-cover');

        frontImg.src = book.image;
        frontImg.className = frontClass;
        backImg.src  = book.image;
        backImg.className = backClass;
        backCover.style.display = isSingle ? 'none' : '';

        document.getElementById('modal-title').textContent     = book.title;
        document.getElementById('modal-author').textContent    = `المؤلف: ${book.author}`;
        document.getElementById('modal-year').textContent      = `سنة النشر: ${book.year}`;
        document.getElementById('modal-desc-text').textContent = book.description;

        const pdfBtn = document.getElementById('modal-pdf-btn');
        if (book.pdf) {
            pdfBtn.href = book.pdf;
            pdfBtn.removeAttribute('hidden');
        } else {
            pdfBtn.setAttribute('hidden', '');
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('modal-back-img').closest('.modal-cover').style.display = '';
    }

    booksContainer.addEventListener('click', e => {
        const btn = e.target.closest('[data-id]');
        if (btn) openModal(parseInt(btn.dataset.id));
    });

    closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
    });

    // Search functionality
    const searchInput = document.getElementById('search-input');
    const noResults   = document.getElementById('no-results');
    const allCards    = Array.from(booksContainer.querySelectorAll('.book-card'));

    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim().toLowerCase();
        let visible = 0;

        allCards.forEach((card, i) => {
            const book = booksData[i];
            const match = !query ||
                book.title.toLowerCase().includes(query) ||
                book.author.toLowerCase().includes(query);
            card.style.display = match ? '' : 'none';
            if (match) visible++;
        });

        noResults.hidden = visible > 0;
    });

    // Smooth scrolling for navigation
    const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            navLinks.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');

            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const offsetPosition =
                    targetElement.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
            }
        });
    });

    window.addEventListener('scroll', () => {
        let current = '';
        document.querySelectorAll('section, header').forEach(section => {
            if (window.pageYOffset >= section.offsetTop - 100) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) link.classList.add('active');
        });
    });
});
