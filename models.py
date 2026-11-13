from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from db import Base, engine

# 1. таблица пользователей
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, nullable=False)
    password = Column(String(50), nullable=False)
    role = Column(String(20), default="user")

# 2. таблица категорий
class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)

    products = relationship("Product", back_populates="category")

# 3. таблица товаров
class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    name = Column(String(150), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    platform = Column(String(50), default="PC")

    category = relationship("Category", back_populates="products")
    keys = relationship("DigitalKey", back_populates="product")

# 4. таблица цифровых ключей
class DigitalKey(Base):
    __tablename__ = "digital_keys"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    key_code = Column(String(100), nullable=False)
    is_sold = Column(Boolean, default=False)

    product = relationship("Product", back_populates="keys")

# создание таблиц в базе при запуске напрямую
if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("таблицы созданы!")
