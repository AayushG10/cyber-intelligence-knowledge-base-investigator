"""Central app configuration, loaded from environment / .env."""

from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()  # read .env once at import time


@dataclass(frozen=True)
class Settings:
    # Neo4j — on Aura the user & database are "neo4j", NOT the instance id.
    neo4j_uri: str = os.getenv("NEO4J_URI", "neo4j+s://03050b8d.databases.neo4j.io")
    neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "")
    neo4j_database: str = os.getenv("NEO4J_DATABASE", "neo4j")

    # SQL / other
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    data_dir: str = os.getenv("DATA_DIR", "./data")

    @property
    def neo4j_password_set(self) -> bool:
        return bool(self.neo4j_password) and self.neo4j_password not in (
            "change_me_local_only", "<password>")


settings = Settings()
