// состояние приложения
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let isRegisterMode = false;
let currentCategory = 'all';

// инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();
    updateCartUI();
    setupEventListeners();
    loadStock();
});

// настройка обработчиков событий
function setupEventListeners() {
    // переключение вход / регистрация
    const authToggleLink = document.getElementById('authToggleLink');
    if (authToggleLink) {
        authToggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            isRegisterMode = !isRegisterMode;
            toggleAuthMode();
        });
    }

    // отправка формы авторизации
    const authForm = document.getElementById('authForm');
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }

    // генерация ключа в админке
    const adminGenKeyBtn = document.getElementById('adminGenKeyBtn');
    if (adminGenKeyBtn) {
        adminGenKeyBtn.addEventListener('click', () => {
            const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
            const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
            const part3 = Math.random().toString(36).substring(2, 6).toUpperCase();
            const part4 = Math.random().toString(36).substring(2, 6).toUpperCase();
            document.getElementById('adminKeyCode').value = `${part1}-${part2}-${part3}-${part4}`;
        });
    }

    // отправка формы пополнения ключей админом
    const adminKeyForm = document.getElementById('adminKeyForm');
    if (adminKeyForm) {
        adminKeyForm.addEventListener('submit', handleAdminAddKey);
    }

    // фильтрация товаров по категориям в шапке
    const filterLinks = document.querySelectorAll('.nav-filter');
    filterLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            filterLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const filter = link.getAttribute('data-filter');
            filterProducts(filter);

            if (filter !== 'all') {
                const catalogEl = document.getElementById('catalog');
                if (catalogEl) {
                    catalogEl.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // плавный скролл к контактам
    const contactsBtn = document.getElementById('contactsNavBtn');
    if (contactsBtn) {
        contactsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const contactsSection = document.getElementById('contacts');
            if (contactsSection) {
                contactsSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // плавный скролл к частым вопросам (FAQ)
    const faqBtn = document.getElementById('faqNavBtn');
    if (faqBtn) {
        faqBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const faqSection = document.getElementById('faq');
            if (faqSection) {
                faqSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    // живой поиск товаров по названию
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilterAndSort);
    }

    // сортировка по цене
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilterAndSort);
    }

    // фильтр по цене (SQL на сервере)
    const priceFilterBtn = document.getElementById('priceFilterBtn');
    if (priceFilterBtn) {
        priceFilterBtn.addEventListener('click', applyPriceFilter);
    }

    // сброс фильтра по цене
    const priceResetBtn = document.getElementById('priceResetBtn');
    if (priceResetBtn) {
        priceResetBtn.addEventListener('click', () => {
            const minEl = document.getElementById('priceMin');
            const maxEl = document.getElementById('priceMax');
            if (minEl) minEl.value = '';
            if (maxEl) maxEl.value = '';
            loadAllProducts();
        });
    }

    // кнопки добавления в корзину в каталоге
    attachBuyHandlers();

    // кнопка оформления заказа в корзине
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }
}

// навешивание обработчиков на кнопки "В корзину" (вынесено отдельно, т.к. карточки перерисовываются)
function attachBuyHandlers() {
    const buyButtons = document.querySelectorAll('.btn-buy');
    buyButtons.forEach(btn => {
        // защита от повторного навешивания
        if (btn.dataset.handlerAttached === '1') return;
        btn.dataset.handlerAttached = '1';

        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const price = parseInt(btn.getAttribute('data-price'), 10);
            addToCart(id, name, price);

            const originalText = btn.textContent;
            btn.textContent = 'Добавлено ✓';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 700);
        });
    });
}

// переключение режима авторизации (вход / регистрация)
function toggleAuthMode() {
    const title = document.getElementById('authModalTitle');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleLink = document.getElementById('authToggleLink');
    const errorBlock = document.getElementById('authError');

    if (errorBlock) errorBlock.classList.add('d-none');

    if (isRegisterMode) {
        if (title) title.textContent = 'Регистрация';
        if (submitBtn) submitBtn.textContent = 'Зарегистрироваться';
        if (toggleLink) toggleLink.textContent = 'Уже есть аккаунт? Войти';
    } else {
        if (title) title.textContent = 'Вход в аккаунт';
        if (submitBtn) submitBtn.textContent = 'Войти';
        if (toggleLink) toggleLink.textContent = 'Нет аккаунта? Зарегистрироваться';
    }
}

// обработка формы авторизации (обращение к fastapi бэкенду)
async function handleAuthSubmit(e) {
    e.preventDefault();

    const loginInput = document.getElementById('authLogin');
    const passwordInput = document.getElementById('authPassword');
    const errorBlock = document.getElementById('authError');

    const login = loginInput.value.trim();
    const password = passwordInput.value.trim();

    const endpoint = isRegisterMode ? '/api/register' : '/api/login';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });

        const data = await response.json();

        if (!response.ok) {
            if (errorBlock) {
                errorBlock.textContent = data.detail || 'Ошибка авторизации';
                errorBlock.classList.remove('d-none');
            }
            return;
        }

        currentUser = { id: data.id, login: data.login, role: data.role };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        document.getElementById('authForm').reset();
        if (errorBlock) errorBlock.classList.add('d-none');

        const authModalEl = document.getElementById('authModal');
        const authModal = bootstrap.Modal.getInstance(authModalEl) || new bootstrap.Modal(authModalEl);
        if (authModal) authModal.hide();

        document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');

        updateAuthUI();

    } catch (err) {
        console.error('Ошибка связи с сервером:', err);
        if (errorBlock) {
            errorBlock.textContent = 'Сервер недоступен. Запустите: python main.py';
            errorBlock.classList.remove('d-none');
        }
    }
}

// обработка добавления ключа админом
async function handleAdminAddKey(e) {
    e.preventDefault();

    const productSelect = document.getElementById('adminProductSelect');
    const keyCodeInput = document.getElementById('adminKeyCode');
    const successBlock = document.getElementById('adminSuccess');
    const errorBlock = document.getElementById('adminError');

    const productId = parseInt(productSelect.value, 10);
    const keyCode = keyCodeInput.value.trim();

    if (successBlock) successBlock.classList.add('d-none');
    if (errorBlock) errorBlock.classList.add('d-none');

    try {
        const response = await fetch('/api/admin/add-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: productId, key_code: keyCode })
        });

        const data = await response.json();

        if (!response.ok) {
            if (errorBlock) {
                errorBlock.textContent = data.detail || 'Ошибка добавления ключа';
                errorBlock.classList.remove('d-none');
            }
            return;
        }

        if (successBlock) {
            successBlock.textContent = data.message || 'Ключ успешно добавлен в базу!';
            successBlock.classList.remove('d-none');
        }

        keyCodeInput.value = '';
        await loadStock();

    } catch (err) {
        console.error('Ошибка добавления ключа:', err);
        if (errorBlock) {
            errorBlock.textContent = 'Ошибка связи с сервером';
            errorBlock.classList.remove('d-none');
        }
    }
}

// загрузка купленных ключей пользователя
async function loadUserKeys() {
    if (!currentUser) return;

    const listEl = document.getElementById('userKeysList');
    const emptyEl = document.getElementById('userKeysEmpty');

    if (!listEl) return;
    listEl.innerHTML = '';

    try {
        const response = await fetch(`/api/user/${currentUser.id}/keys`);
        if (!response.ok) return;

        const keys = await response.json();

        if (keys.length === 0) {
            if (emptyEl) emptyEl.classList.remove('d-none');
            return;
        }

        if (emptyEl) emptyEl.classList.add('d-none');

        keys.forEach(k => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center px-0 py-3';
            li.innerHTML = `
                <div>
                    <div class="fw-bold mb-1">${k.product_name} <span class="badge bg-light text-secondary border ms-1 small">${k.platform}</span></div>
                    <div class="font-monospace small bg-light p-1 px-2 rounded border d-inline-block text-dark fw-bold">${k.key_code}</div>
                </div>
                <button class="btn btn-outline-secondary btn-sm py-1 px-2" type="button" onclick="navigator.clipboard.writeText('${k.key_code}'); this.textContent='Скопировано ✓'; setTimeout(() => this.textContent='Копировать', 1000);">Копировать</button>
            `;
            listEl.appendChild(li);
        });

    } catch (err) {
        console.error('Ошибка загрузки ключей пользователя:', err);
    }
}

// обновление отображения пользователя в шапке
function updateAuthUI() {
    const container = document.getElementById('authContainer');
    if (!container) return;

    if (currentUser) {
        if (currentUser.role === 'admin') {
            container.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-dark fw-normal">${currentUser.login}</span>
                    <button class="btn btn-outline-secondary btn-sm py-0 px-2" id="myKeysBtn" type="button" data-bs-toggle="modal" data-bs-target="#userKeysModal" style="font-size: 0.75rem;">Мои покупки</button>
                    <button class="btn btn-outline-primary btn-sm py-0 px-2" type="button" data-bs-toggle="modal" data-bs-target="#adminModal" style="font-size: 0.75rem;">+ Добавить ключи</button>
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" id="logoutBtn" style="font-size: 0.75rem;">Выйти</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="small text-secondary fw-semibold">${currentUser.login}</span>
                    <button class="btn btn-outline-secondary btn-sm py-0 px-2" id="myKeysBtn" type="button" data-bs-toggle="modal" data-bs-target="#userKeysModal" style="font-size: 0.75rem;">Мои покупки</button>
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" id="logoutBtn" style="font-size: 0.75rem;">Выйти</button>
                </div>
            `;
        }
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
        const myKeysBtn = document.getElementById('myKeysBtn');
        if (myKeysBtn) myKeysBtn.addEventListener('click', loadUserKeys);
    } else {
        container.innerHTML = `
            <button class="btn btn-dark btn-sm" id="loginNavBtn" type="button" data-bs-toggle="modal" data-bs-target="#authModal">
                Войти
            </button>
        `;
    }
}

// выход из профиля
function handleLogout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthUI();
}

// получение реального остатка ключей из базы данных
async function loadStock() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) return;

        const products = await response.json();
        products.forEach(p => {
            const stockEl = document.getElementById(`stock-${p.id}`);
            const btn = document.querySelector(`.btn-buy[data-id="${p.id}"]`);

            if (stockEl) {
                if (p.available_keys > 0) {
                    stockEl.className = 'text-muted small mb-2';
                    stockEl.textContent = `В наличии: ${p.available_keys} шт.`;
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'В корзину';
                    }
                } else {
                    stockEl.className = 'text-danger small mb-2';
                    stockEl.textContent = 'Нет в наличии';
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = 'Закончился';
                    }
                }
            }
        });
    } catch (err) {
        console.error('Ошибка обновления остатков ключей:', err);
    }
}

// фильтрация карточек товаров по категориям из меню
function filterProducts(category) {
    currentCategory = category;
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    if (category === 'games') {
        if (pageTitle) pageTitle.textContent = 'Компьютерные игры';
        if (pageSubtitle) pageSubtitle.textContent = 'Лицензионные ключи активации для Steam и PC';
    } else if (category === 'programs') {
        if (pageTitle) pageTitle.textContent = 'Программное обеспечение';
        if (pageSubtitle) pageSubtitle.textContent = 'Операционные системы и офисные программы';
    } else {
        if (pageTitle) pageTitle.textContent = 'Каталог цифровых товаров';
        if (pageSubtitle) pageSubtitle.textContent = 'Лицензионные ключи активации с моментальной выдачей';
    }

    applyFilterAndSort();
}

// применение живого поиска и сортировки по цене
function applyFilterAndSort() {
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const grid = document.getElementById('productsGrid');
    const noProductsFound = document.getElementById('noProductsFound');

    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const sortOrder = sortSelect ? sortSelect.value : 'default';

    const cards = Array.from(document.querySelectorAll('.product-card-col'));
    let visibleCount = 0;

    cards.sort((a, b) => {
        const btnA = a.querySelector('.btn-buy');
        const btnB = b.querySelector('.btn-buy');
        const priceA = parseInt(btnA?.getAttribute('data-price') || '0', 10);
        const priceB = parseInt(btnB?.getAttribute('data-price') || '0', 10);
        const idA = parseInt(btnA?.getAttribute('data-id') || '0', 10);
        const idB = parseInt(btnB?.getAttribute('data-id') || '0', 10);

        if (sortOrder === 'price-asc') {
            return priceA - priceB;
        } else if (sortOrder === 'price-desc') {
            return priceB - priceA;
        } else {
            return idA - idB;
        }
    });

    cards.forEach(card => {
        if (grid) grid.appendChild(card);

        const itemCategory = card.getAttribute('data-category');
        const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';

        const matchesCategory = (currentCategory === 'all' || itemCategory === currentCategory);
        const matchesQuery = !query || title.includes(query);

        if (matchesCategory && matchesQuery) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    if (noProductsFound) {
        if (visibleCount === 0) {
            noProductsFound.classList.remove('d-none');
        } else {
            noProductsFound.classList.add('d-none');
        }
    }
}

// фильтрация товаров по цене через сервер
async function loadAllProducts() {
    try {
        const response = await fetch('/api/products');
        if (!response.ok) return;
        const products = await response.json();
        renderProducts(products);
    } catch (err) {
        console.error('Ошибка загрузки товаров:', err);
    }
}

// отправка запроса с диапазоном цен
async function applyPriceFilter() {
    const minEl = document.getElementById('priceMin');
    const maxEl = document.getElementById('priceMax');
    const min = minEl ? minEl.value.trim() : '';
    const max = maxEl ? maxEl.value.trim() : '';

    if (!min && !max) {
        await loadAllProducts();
        return;
    }

    if (min && max && parseFloat(min) > parseFloat(max)) {
        alert('Цена "от" не может быть больше цены "до"');
        return;
    }

    const params = [];
    if (min) params.push(`price_min=${encodeURIComponent(min)}`);
    if (max) params.push(`price_max=${encodeURIComponent(max)}`);

    try {
        const response = await fetch(`/api/products?${params.join('&')}`);
        if (!response.ok) return;
        const products = await response.json();
        renderProducts(products);
    } catch (err) {
        console.error('Ошибка фильтра по цене:', err);
    }
}

// перерисовка карточек товаров по данным с сервера
function renderProducts(products) {
    const grid = document.getElementById('productsGrid');
    const noProductsFound = document.getElementById('noProductsFound');
    if (!grid) return;

    grid.querySelectorAll('.product-card-col').forEach(el => el.remove());

    if (products.length === 0) {
        if (noProductsFound) noProductsFound.classList.remove('d-none');
        return;
    }
    if (noProductsFound) noProductsFound.classList.add('d-none');

    // описания и изображения товаров
    const meta = {
        1:  { img: 'img/cyberpunk.png',  desc: 'Шпионский экшен в Найт-Сити с Киану Ривзом.',            link: '/cyberpunk.html', cat: 'games',    btn: 'Об игре' },
        2:  { img: 'img/eldenring.png',  desc: 'Ролевая игра года в открытом мире от FromSoftware.',     link: null,              cat: 'games',    btn: null },
        3:  { img: 'img/windows.jpg',    desc: 'Официальный бессрочный ключ для операционной системы.',  link: '/windows.html',   cat: 'programs', btn: 'О системе' },
        4:  { img: 'img/gtav.jpg',       desc: 'Легендарный криминальный экшен в Лос-Сантосе от Rockstar Games.', link: null,      cat: 'games',    btn: null },
        5:  { img: 'img/rdr2.jpg',       desc: 'Грандиозная история Артура Моргана и банды Ван дер Линде на Диком Западе.', link: null, cat: 'games',    btn: null },
        6:  { img: 'img/office.svg',     desc: 'Пакет офисных программ: Word, Excel, PowerPoint с бессрочной лицензией.', link: null,  cat: 'programs', btn: null },
        7:  { img: 'img/witcher3.jpg',   desc: 'Культовая ролевая игра о ведьмаке Геральте из Ривии.',    link: null,              cat: 'games',    btn: null },
        8:  { img: 'img/forza6.jpg',     desc: 'Долгожданное продолжение легендарного гоночного фестиваля нового поколения.', link: '/forza6.html', cat: 'games', btn: 'Об игре' },
        9:  { img: 'img/hogwarts.jpg',   desc: 'Погрузитесь в мир магии Хогвартса конца XIX века с открытым миром.', link: null, cat: 'games',    btn: null },
        10: { img: 'img/forza5.jpg',     desc: 'Красочный гоночный симулятор в открытом мире фестиваля Мексики.', link: null,      cat: 'games',    btn: null },
        11: { img: 'img/photoshop.svg',  desc: 'Мировой стандарт графического дизайна и обработки фотографий.', link: null,          cat: 'programs', btn: null },
        12: { img: 'img/steam.svg',      desc: 'Мгновенный промокод для пополнения кошелька Steam на 1000 рублей.', link: null,      cat: 'programs', btn: null }
    };

    products.forEach(p => {
        const m = meta[p.id] || { img: 'img/ByteStore.png', desc: '', link: null, cat: 'games', btn: null };
        const inStock = p.available_keys > 0;
        const priceFormatted = p.price.toLocaleString('ru-RU');

        const catLabel = m.cat === 'games' ? 'Игры' : 'Программы';
        const badge = `${catLabel} / ${p.platform || 'PC'}`;

        const aboutBtn = m.link && m.btn
            ? `<a href="${m.link}" class="btn btn-outline-secondary btn-sm">${m.btn}</a>`
            : '';

        const buyBtn = inStock
            ? `<button class="btn btn-dark btn-sm btn-buy" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">В корзину</button>`
            : `<button class="btn btn-dark btn-sm btn-buy" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" disabled>Закончился</button>`;

        const imgHtml = m.link
            ? `<a href="${m.link}" class="d-block text-center"><img src="${m.img}" class="card-img-top p-2" alt="${p.name}" style="height: 230px; object-fit: contain;"></a>`
            : `<img src="${m.img}" class="card-img-top p-2" alt="${p.name}" style="height: 230px; object-fit: contain;">`;

        const titleHtml = m.link
            ? `<a href="${m.link}" class="text-decoration-none text-dark"><h5 class="card-title fw-bold mb-1">${p.name}</h5></a>`
            : `<h5 class="card-title fw-bold mb-1">${p.name}</h5>`;

        const stockHtml = inStock
            ? `<div class="text-muted small mb-2" id="stock-${p.id}">В наличии: ${p.available_keys} шт.</div>`
            : `<div class="text-danger small mb-2" id="stock-${p.id}">Нет в наличии</div>`;

        const col = document.createElement('div');
        col.className = 'col product-card-col';
        col.setAttribute('data-category', m.cat);
        col.innerHTML = `
            <div class="card h-100 shadow-sm border-0">
                ${imgHtml}
                <div class="card-body d-flex flex-column">
                    <span class="badge bg-secondary align-self-start mb-2">${badge}</span>
                    ${titleHtml}
                    ${stockHtml}
                    <p class="card-text text-secondary small flex-grow-1">${m.desc}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                        <span class="fw-bold fs-5">${priceFormatted} руб.</span>
                        <div class="d-flex gap-1">
                            ${aboutBtn}
                            ${buyBtn}
                        </div>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(col);
    });

    // навешиваем обработчики на новые кнопки "В корзину"
    attachBuyHandlers();

    // применяем фильтрацию и сортировку
    applyFilterAndSort();
}

// добавление товара в корзину
function addToCart(id, name, price) {
    cart.push({ id, name, price });
    saveCart();
    updateCartUI();

    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.classList.add('btn-secondary');
        cartBtn.classList.remove('btn-outline-secondary');
        setTimeout(() => {
            cartBtn.classList.remove('btn-secondary');
            cartBtn.classList.add('btn-outline-secondary');
        }, 300);
    }
}

// удаление товара из корзины по индексу
function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    updateCartUI();
}

// сохранение корзины в локалсторадж
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// обновление содержимого корзины
function updateCartUI() {
    const countEl = document.getElementById('cartCount');
    const listEl = document.getElementById('cartList');
    const emptyEl = document.getElementById('cartEmpty');
    const totalEl = document.getElementById('cartTotalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');

    if (countEl) countEl.textContent = cart.length;

    if (!listEl) return;

    listEl.innerHTML = '';

    if (cart.length === 0) {
        if (emptyEl) emptyEl.classList.remove('d-none');
        if (totalEl) totalEl.textContent = '0 руб.';
        if (checkoutBtn) checkoutBtn.disabled = true;
        return;
    }

    if (emptyEl) emptyEl.classList.add('d-none');

    let total = 0;
    cart.forEach((item, index) => {
        total += item.price;

        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center px-0 py-2';
        li.innerHTML = `
            <div>
                <div class="fw-bold small">${item.name}</div>
                <div class="text-secondary small">${item.price.toLocaleString('ru-RU')} руб.</div>
            </div>
            <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="removeFromCart(${index})" title="Удалить">&times;</button>
        `;
        listEl.appendChild(li);
    });

    if (totalEl) totalEl.textContent = `${total.toLocaleString('ru-RU')} руб.`;
    if (checkoutBtn) checkoutBtn.disabled = false;
}

// оформление покупки всех товаров из корзины
async function handleCheckout() {
    if (cart.length === 0) return;

    // проверка авторизации
    if (!currentUser) {
        const cartModalEl = document.getElementById('cartModal');
        const cartModal = bootstrap.Modal.getInstance(cartModalEl) || new bootstrap.Modal(cartModalEl);
        if (cartModal) cartModal.hide();

        const authModalEl = document.getElementById('authModal');
        const authModal = new bootstrap.Modal(authModalEl);
        authModal.show();

        const errorBlock = document.getElementById('authError');
        if (errorBlock) {
            errorBlock.textContent = 'Для оформления покупки необходимо войти в аккаунт';
            errorBlock.classList.remove('d-none');
        }
        return;
    }

    // группировка одинаковых товаров для покупки
    const grouped = {};
    cart.forEach(item => {
        if (!grouped[item.id]) grouped[item.id] = { name: item.name, qty: 0 };
        grouped[item.id].qty++;
    });

    const issued = [];
    const failed = [];

    try {
        for (const [id, info] of Object.entries(grouped)) {
            for (let i = 0; i < info.qty; i++) {
                const response = await fetch(`/api/buy/${id}?user_id=${currentUser.id}`, {
                    method: 'POST'
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    failed.push({ name: info.name, reason: errData.detail || 'Ошибка покупки' });
                    break;
                }

                const data = await response.json();
                issued.push({ name: info.name, key: data.key_code });

                // удаляем один купленный товар из корзины
                const cartIdx = cart.findIndex(c => c.id == id);
                if (cartIdx !== -1) {
                    cart.splice(cartIdx, 1);
                }
            }
        }

        saveCart();
        updateCartUI();

        // закрываем корзину
        const cartModalEl = document.getElementById('cartModal');
        const cartModal = bootstrap.Modal.getInstance(cartModalEl) || new bootstrap.Modal(cartModalEl);
        if (cartModal) cartModal.hide();

        // показываем модалку успеха
        const issuedKeyEl = document.getElementById('issuedKey');
        const subtitleEl = document.getElementById('issuedKeySubtitle');
        if (subtitleEl) {
            subtitleEl.textContent = issued.length > 1
                ? 'Ваши цифровые ключи активации:'
                : 'Ваш цифровой ключ активации:';
        }
        if (issuedKeyEl) {
            if (issued.length === 1) {
                issuedKeyEl.classList.remove('fs-6');
                issuedKeyEl.classList.add('fs-5');
                issuedKeyEl.textContent = issued[0].key;
            } else if (issued.length > 1) {
                issuedKeyEl.classList.remove('fs-5');
                issuedKeyEl.classList.add('fs-6');
                issuedKeyEl.innerHTML = issued.map(x =>
                    `<div class="mb-2 text-start">
                        <div class="text-secondary small">${x.name}</div>
                        <div class="font-monospace fw-bold">${x.key}</div>
                    </div>`
                ).join('');
            } else {
                issuedKeyEl.textContent = '—';
            }
        }
            } else if (issued.length > 1) {
                issuedKeyEl.classList.remove('fs-5');
                issuedKeyEl.classList.add('fs-6');
                issuedKeyEl.innerHTML = issued.map(x =>
                    `<div class="mb-2 text-start">
                        <div class="text-secondary small">${x.name}</div>
                        <div class="font-monospace fw-bold">${x.key}</div>
                    </div>`
                ).join('');
            } else {
                issuedKeyEl.textContent = '—';
            }
        }

        if (failed.length > 0) {
            alert('Не удалось купить:\n' + failed.map(f => `• ${f.name} — ${f.reason}`).join('\n'));
        }

        if (issued.length > 0) {
            const successModalEl = document.getElementById('successModal');
            const successModal = new bootstrap.Modal(successModalEl);
            successModal.show();
        }

        await loadStock();

    } catch (err) {
        console.error('Ошибка соединения с сервером:', err);
        alert('Ошибка связи с сервером! Запустите бэкенд на FastAPI: python main.py');
    }
}