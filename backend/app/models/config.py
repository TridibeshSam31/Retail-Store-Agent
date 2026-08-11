from sqlalchemy import Column, Integer, ForeignKey

from app.core.db import Base


class Config(Base):
    __tablename__ = "config"

    org_id = Column(Integer, ForeignKey("orgs.org_id"), primary_key=True)
    batch_x = Column(Integer, nullable=False)
    max_negotiation_turns = Column(Integer, nullable=False)
