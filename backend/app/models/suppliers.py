from sqlalchemy import Column, Integer, String, ForeignKey

from app.core.db import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id = Column(Integer, primary_key=True, autoincrement=True)
    store_id = Column(Integer, ForeignKey("stores.store_id"))
    item_id = Column(Integer, ForeignKey("items.item_id"), nullable=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(20))
    email = Column(String(150))
    pref = Column(String(10), default="whatsapp")  # whatsapp | email
