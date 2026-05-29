"""End-to-end pipeline tests against the live LexIA API."""
import os

import pytest
import requests

API_BASE = os.environ.get("LEXIA_API_URL", "http://localhost:8080")
ADMIN_EMAIL = os.environ.get("LEXIA_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("LEXIA_ADMIN_PASSWORD", "StrongPass123!")


def _url(path: str) -> str:
    return f"{API_BASE}{path}"


def _admin_token() -> str:
    resp = requests.post(_url("/api/auth/login"), json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


class TestHealth:
    def test_healthz(self):
        resp = requests.get(_url("/api/healthz"), timeout=10)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["database"] == "ok"


class TestAuth:
    def test_login_admin(self):
        resp = requests.post(_url("/api/auth/login"), json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["user"]["role"] == "ADMIN"

    def test_me(self):
        token = _admin_token()
        resp = requests.get(_url("/api/auth/me"), headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert resp.status_code == 200
        assert resp.json()["email"] == ADMIN_EMAIL

    def test_forgot_password_enumeration_safe(self):
        resp = requests.post(_url("/api/auth/forgot-password"), json={"email": "nobody@example.com"}, timeout=10)
        assert resp.status_code == 200


class TestDocuments:
    def test_list_documents(self):
        token = _admin_token()
        resp = requests.get(_url("/api/documents"), headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestRag:
    def test_search(self):
        token = _admin_token()
        resp = requests.post(
            _url("/api/rag/search"),
            headers={"Authorization": f"Bearer {token}"},
            json={"query": "convention collective entreprise culturelle", "max_results": 3},
            timeout=10,
        )
        assert resp.status_code == 200
        assert "items" in resp.json()

    def test_context(self):
        token = _admin_token()
        resp = requests.post(
            _url("/api/rag/context"),
            headers={"Authorization": f"Bearer {token}"},
            json={"query": "Quels sont les droits des artistes?", "max_chunks": 3},
            timeout=10,
        )
        assert resp.status_code == 200


class TestAi:
    def test_query(self):
        token = _admin_token()
        resp = requests.post(
            _url("/api/ai/query"),
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Explique les dispositions de la convention collective pour les entreprises culturelles"},
            timeout=30,
        )
        assert resp.status_code == 200
        assert "answer" in resp.json() or "response" in resp.json()

    def test_explain(self):
        token = _admin_token()
        resp = requests.post(
            _url("/api/ai/explain"),
            headers={"Authorization": f"Bearer {token}"},
            json={"question": "Explique le concept de convention collective"},
            timeout=30,
        )
        assert resp.status_code == 200

    def test_analyze(self):
        token = _admin_token()
        resp = requests.post(
            _url("/api/ai/analyze"),
            headers={"Authorization": f"Bearer {token}"},
            json={
                "question": "Quels sont les droits des artistes-interpretes?",
                "situation": "Un artiste interprete signe un contrat avec une entreprise de production",
            },
            timeout=30,
        )
        assert resp.status_code == 200


class TestStats:
    def test_dashboard(self):
        token = _admin_token()
        resp = requests.get(_url("/api/stats/dashboard"), headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert resp.status_code == 200
        body = resp.json()
        assert "totalDocuments" in body

    def test_domains(self):
        token = _admin_token()
        resp = requests.get(_url("/api/stats/domains"), headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert resp.status_code == 200


class TestPromptAdmin:
    def test_list_bases(self):
        token = _admin_token()
        resp = requests.get(_url("/api/ai/prompts/bases"), headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_templates(self):
        token = _admin_token()
        resp = requests.get(_url("/api/ai/prompts/templates"), headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert resp.status_code == 200

    def test_list_versions(self):
        token = _admin_token()
        resp = requests.get(_url("/api/ai/prompts/versions"), headers={"Authorization": f"Bearer {token}"}, timeout=10)
        assert resp.status_code == 200


class TestPhpAdapter:
    def test_query(self):
        resp = requests.post(
            _url("/api/adapter/ai/query"),
            json={"question": "Que dit la loi sur les artistes?"},
            timeout=10,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "request_id" in body

    def test_analyze(self):
        resp = requests.post(
            _url("/api/adapter/ai/analyze"),
            json={"question": "Analyse ce contrat de travail", "document": "Un contrat de travail pour un artiste interprete"},
            timeout=10,
        )
        assert resp.status_code == 200


class TestInfra:
    def test_ollama_status(self):
        resp = requests.get(_url("/api/ollama/status"), timeout=10)
        assert resp.status_code == 200
