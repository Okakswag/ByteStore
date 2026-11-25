from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from db import SessionLocal, engine, Base
from models import Product, Category, DigitalKey, User

# создание таблиц в базе данных если еще не созданы
Base.metadata.create_all(bind=engine)

# инициализация приложения fastapi
app = FastAPI(title="ByteStore API")

# настройка cors для работы с фронтендом
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# схема данных для входа и регистрации
class AuthData(BaseModel):
    login: str
    password: str

# схема данных для пополнения ключей админом
class AddKeyData(BaseModel):
    product_id: int
    key_code: str

# функция получения сессии базы данных
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# главная страница сайта
@app.get("/")
def read_root():
    return FileResponse("index.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

# промо-страницы товаров
@app.get("/cyberpunk.html")
def read_cyberpunk():
    return FileResponse("cyberpunk.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

@app.get("/forza6.html")
def read_forza6():
    return FileResponse("forza6.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

@app.get("/windows.html")
def read_windows():
    return FileResponse("windows.html", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

# скрипт фронтенда
@app.get("/app.js")
def read_js():
    return FileResponse("app.js", headers={"Cache-Control": "no-cache, no-store, must-revalidate"})

# вход в аккаунт
@app.post("/api/login")
def login(data: AuthData, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.login == data.login).first()
    if not user or user.password != data.password:
        raise HTTPException(status_code=400, detail="Неверный логин или пароль")

    return {
        "success": True,
        "id": user.id,
        "login": user.login,
        "role": user.role
    }

# регистрация нового пользователя
@app.post("/api/register")
def register(data: AuthData, db: Session = Depends(get_db)):
    # проверка уникальности логина в базе
    existing = db.query(User).filter(User.login == data.login).first()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    new_user = User(login=data.login, password=data.password, role="user")
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "success": True,
        "id": new_user.id,
        "login": new_user.login,
        "role": new_user.role
    }

# получение каталога товаров (с поддержкой фильтра по цене)
@app.get("/api/products")
def get_products(
    price_min: Optional[float] = Query(None, description="Минимальная цена"),
    price_max: Optional[float] = Query(None, description="Максимальная цена"),
    db: Session = Depends(get_db)
):
    query = db.query(Product)

    # фильтрация по диапазону цен
    if price_min is not None:
        query = query.filter(Product.price >= price_min)
    if price_max is not None:
        query = query.filter(Product.price <= price_max)

    products = query.all()
    result = []
    for p in products:
        # подсчет свободных ключей для каждого товара
        available_count = db.query(DigitalKey).filter(
            DigitalKey.product_id == p.id,
            DigitalKey.is_sold == False
        ).count()

        result.append({
            "id": p.id,
            "name": p.name,
            "price": float(p.price),
            "platform": p.platform,
            "category_id": p.category_id,
            "available_keys": available_count
        })
    return result

# покупка товара и списание ключа из базы данных
@app.post("/api/buy/{product_id}")
def buy_product(product_id: int, user_id: int = None, db: Session = Depends(get_db)):
    # поиск первого свободного ключа
    key = db.query(DigitalKey).filter(
        DigitalKey.product_id == product_id,
        DigitalKey.is_sold == False
    ).first()

    if not key:
        raise HTTPException(status_code=400, detail="Ключи для этого товара закончились")

    # смена статуса на продан и привязка к покупателю
    key.is_sold = True
    if user_id:
        key.user_id = user_id
    db.commit()

    return {
        "success": True,
        "product_id": product_id,
        "key_code": key.key_code
    }

# просмотр купленных ключей пользователя (Личный кабинет по ТЗ)
@app.get("/api/user/{user_id}/keys")
def get_user_keys(user_id: int, db: Session = Depends(get_db)):
    keys = db.query(DigitalKey).filter(DigitalKey.user_id == user_id).all()
    result = []
    for k in keys:
        prod = db.query(Product).filter(Product.id == k.product_id).first()
        result.append({
            "key_code": k.key_code,
            "product_name": prod.name if prod else "Товар",
            "price": float(prod.price) if prod else 0,
            "platform": prod.platform if prod else "PC"
        })
    return result

# пополнение склада ключей администратором
@app.post("/api/admin/add-key")
def add_key(data: AddKeyData, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == data.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")

    new_key = DigitalKey(product_id=data.product_id, key_code=data.key_code, is_sold=False)
    db.add(new_key)
    db.commit()

    return {
        "success": True,
        "message": f"Ключ успешно добавлен к товару {product.name}"
    }

# раздача статических файлов (изображения и шрифты)
app.mount("/img", StaticFiles(directory="img"), name="img")
app.mount("/fonts", StaticFiles(directory="fonts"), name="fonts")

# запуск сервера
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)