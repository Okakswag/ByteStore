from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# подключение к базе данных
DATABASE_URL = "postgresql://postgres:123@localhost:5432/bytestore"

# создание движка базы данных
engine = create_engine(DATABASE_URL)

# создание сессии для выполнения запросов
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# базовый класс для моделей
Base = declarative_base()

# проверка подключения при запуске файла напрямую
if __name__ == "__main__":
    try:
        with engine.connect() as connection:
            print("подключение к postgresql прошло успешно!")
    except Exception as e:
        print("ошибка подключения к базе данных:", e)

