from sqlalchemy import Column, Integer, String, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.core.db import Base


class Org(Base):
    __tablename__ = "orgs"

    org_id = Column(Integer, primary_key=True)
    org_name = Column(String(100), nullable=False)

    stores = relationship("Store", back_populates="org")


class Store(Base):
    __tablename__ = "stores"

    store_id = Column(Integer, primary_key=True)
    org_id = Column(Integer, ForeignKey("orgs.org_id"), nullable=False)
    location_name = Column(String(100), nullable=False)
    latitude = Column(Numeric(9, 6))
    longitude = Column(Numeric(9, 6))

    org = relationship("Org", back_populates="stores")


class StoreDistance(Base):
    __tablename__ = "store_distances"

    store_id_a = Column(Integer, ForeignKey("stores.store_id"), primary_key=True)
    store_id_b = Column(Integer, ForeignKey("stores.store_id"), primary_key=True)
    tier = Column(String(10), nullable=False)  # near | medium | far
    est_hours = Column(Numeric(5, 2), nullable=False)
