// состояние приложения
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
let isRegisterMode = false;

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

            // переключение активного пункта в меню
            filterLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const filter = link.getAttribute('data-filter');
            filterProducts(filter);
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

    // кнопки добавления в корзину в каталоге
    const buyButtons = document.querySelectorAll('.btn-buy');
    buyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            const name = btn.getAttribute('data-name');
            const price = parseInt(btn.getAttribute('data-price'), 10);
            addToCart(id, name, price);

            // легкая анимация текста кнопки при добавлении
            const originalText = btn.textContent;
            btn.textContent = 'Добавлено ✓';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 700);
        });
    });

    // кнопка оформления заказа в корзине
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }
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

        // сохраняем пользователя
        currentUser = { id: data.id, login: data.login, role: data.role };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // сбрасываем форму и закрываем окно
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

// обновление отображения пользователя в шапке
function updateAuthUI() {
    const container = document.getElementById('authContainer');
    if (!container) return;

    if (currentUser) {
        if (currentUser.role === 'admin') {
            container.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-dark fw-normal">${currentUser.login}</span>
                    <button class="btn btn-outline-primary btn-sm py-0 px-2" type="button" data-bs-toggle="modal" data-bs-target="#adminModal" style="font-size: 0.75rem;">+ Добавить ключи</button>
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" id="logoutBtn" style="font-size: 0.75rem;">Выйти</button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <span class="small text-secondary fw-semibold">${currentUser.login}</span>
                    <button class="btn btn-outline-danger btn-sm py-0 px-2" id="logoutBtn" style="font-size: 0.75rem;">Выйти</button>
                </div>
            `;
        }
        document.getElementById('logoutBtn').addEventListener('click', handleLogout);
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

// фильтрация карточек товаров
function filterProducts(category) {
    const cards = document.querySelectorAll('.product-card-col');
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

    cards.forEach(card => {
        const itemCategory = card.getAttribute('data-category');
        if (category === 'all' || itemCategory === category) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// добавление товара в корзину
function addToCart(id, name, price) {
    cart.push({ id, name, price });
    saveCart();
    updateCartUI();

    // легкая подсветка кнопки корзины в шапке
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

// оформление покупки и списание ключа через бэкенд
async function handleCheckout() {
    if (cart.length === 0) return;

    // проверка авторизации: если не вошел, просим войти
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

    const firstItem = cart[0];

    try {
        // строгий запрос к fastapi бэкенду
        const response = await fetch(`/api/buy/${firstItem.id}`, {
            method: 'POST'
        });

        if (!response.ok) {
            const errData = await response.json();
            alert(errData.detail || 'Ошибка при оформлении заказа');
            return;
        }

        const data = await response.json();
        const key = data.key_code;

        // закрываем корзину
        const cartModalEl = document.getElementById('cartModal');
        const cartModal = bootstrap.Modal.getInstance(cartModalEl) || new bootstrap.Modal(cartModalEl);
        if (cartModal) cartModal.hide();

        // очищаем корзину
        cart = [];
        saveCart();
        updateCartUI();

        // показываем модалку успеха с настоящим ключом из базы данных
        const issuedKeyEl = document.getElementById('issuedKey');
        if (issuedKeyEl) {
            issuedKeyEl.textContent = key;
        }

        const successModalEl = document.getElementById('successModal');
        const successModal = new bootstrap.Modal(successModalEl);
        successModal.show();

        // обновляем счетчики остатка ключей на карточках
        await loadStock();

    } catch (err) {
        console.error('Ошибка соединения с сервером:', err);
        alert('Ошибка связи с сервером! Запустите бэкенд на FastAPI: python main.py');
    }
}
