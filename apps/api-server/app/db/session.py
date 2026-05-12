"""
SQLAlchemy session setup.

Defines:
- engine: database connection engine.
- SessionLocal: session factory used by API routes and workers.
- get_db(): FastAPI dependency that opens and closes a DB session per request.

Routers use:
    db: Session = Depends(get_db)

Workers use:
    db = SessionLocal()
"""


from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
)


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db():

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()