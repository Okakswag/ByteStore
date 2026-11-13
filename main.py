from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
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
    return FileResponse("index.html")

# скрипт фронтенда
@app.get("/app.js")
def read_js():
    return FileResponse("app.js")

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

# получение каталога товаров из базы данных
@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).all()
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
def buy_product(product_id: int, db: Session = Depends(get_db)):
    # поиск первого свободного ключа
    key = db.query(DigitalKey).filter(
        DigitalKey.product_id == product_id,
        DigitalKey.is_sold == False
    ).first()

    if not key:
        raise HTTPException(status_code=400, detail="Ключи для этого товара закончились")

    # смена статуса на продан
    key.is_sold = True
    db.commit()

    return {
        "success": True,
        "product_id": product_id,
        "key_code": key.key_code
    }

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

# раздача картинок товаров
app.mount("/img", StaticFiles(directory="img"), name="img")

# запуск сервера
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
