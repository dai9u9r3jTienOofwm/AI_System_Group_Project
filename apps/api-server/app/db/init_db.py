import time
from app.db.base import Base
from app.db.session import engine
from sqlalchemy.exc import OperationalError
from app.models.document import Document  # noqa
from app.models.user import User  # noqa


def init_db():
    max_retries = 10
    delay = 2
    for attempt in range(1,max_retries + 1):
        try:
            Base.metadata.create_all(bind=engine)
            print("Connect PostgreSQL successfully!")
            return
        except OperationalError:
            if attempt == max_retries:
                print("Cannot connect to PostgreSql!")
                raise    
            print(f"Attemp {attempt}/{max_retries} failed")
            time.sleep(delay)