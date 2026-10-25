"""Авторизация: права ролей и владение записями (чужое для сотрудника — 404, запрещённая операция — 403)."""
import pytest


@pytest.fixture()
def alice(create_user):
    return create_user("employee", "alice@example.com", "Алиса")


@pytest.fixture()
def bob(create_user):
    return create_user("employee", "bob@example.com", "Боб")


@pytest.fixture()
def world(client, client_for, alice, bob, make_budget, make_trip):
    """Две командировки (Алисы и Боба) с авансом и расходом у каждой. Данные создаёт руководитель."""
    budget = make_budget("1000000.00")
    data = {}
    for name, user in (("alice", alice), ("bob", bob)):
        trip = make_trip("100000.00", user=user, budget=budget)
        adv = client.post("/advances", json={"trip_id": trip["id"], "amount": "10000"}).json()
        exp = client.post(
            "/expenses",
            json={"trip_id": trip["id"], "category": "meals", "description": "Обед", "amount": "500", "expense_date": "2026-11-04"},
        ).json()
        data[name] = {"trip": trip, "advance": adv, "expense": exp}
    data["budget"] = budget
    return data


# ---------- сотрудник: командировки ----------
def test_employee_sees_only_own_trips(client_for, alice, world):
    c = client_for(alice)
    ids = [t["id"] for t in c.get("/trips").json()]
    assert ids == [world["alice"]["trip"]["id"]]
    # параметр user_id не позволяет заглянуть к другим
    assert [t["id"] for t in c.get("/trips", params={"user_id": world["bob"]["trip"]["user_id"]}).json()] == ids


def test_employee_cannot_access_foreign_trip(client_for, alice, world):
    c = client_for(alice)
    tid = world["bob"]["trip"]["id"]
    for r in (c.get(f"/trips/{tid}"), c.patch(f"/trips/{tid}", json={"destination": "Х"}), c.delete(f"/trips/{tid}")):
        assert r.status_code == 404 and "не найден" in r.json()["detail"]


def test_employee_creates_trip_for_self_by_default(client_for, alice, make_budget):
    c = client_for(alice)
    r = c.post("/trips", json={"destination": "Тверь", "start_date": "2026-12-01", "end_date": "2026-12-02", "budget_id": make_budget()["id"]})
    assert r.status_code == 201 and r.json()["user_id"] == alice["id"] and r.json()["status"] == "draft"


def test_employee_cannot_create_trip_for_someone_else(client_for, alice, bob, make_budget):
    r = client_for(alice).post(
        "/trips", json={"destination": "Тверь", "start_date": "2026-12-01", "end_date": "2026-12-02", "budget_id": make_budget()["id"], "user_id": bob["id"]}
    )
    assert r.status_code == 403


@pytest.mark.parametrize("status,expected", [("draft", 200), ("pending", 200), ("approved", 403), ("rejected", 403), ("completed", 403)])
def test_employee_status_limits(client_for, alice, world, status, expected):
    r = client_for(alice).patch(f"/trips/{world['alice']['trip']['id']}", json={"status": status})
    assert r.status_code == expected


def test_manager_approves_trips_and_sees_everything(client, world):
    assert len(client.get("/trips").json()) == 2
    r = client.patch(f"/trips/{world['bob']['trip']['id']}", json={"status": "approved"})
    assert r.status_code == 200 and r.json()["status"] == "approved"


def test_manager_creates_trip_for_employee(client, alice, make_budget):
    r = client.post("/trips", json={"destination": "Пермь", "start_date": "2026-12-01", "end_date": "2026-12-02", "budget_id": make_budget()["id"], "user_id": alice["id"]})
    assert r.status_code == 201 and r.json()["user_id"] == alice["id"]


def test_accountant_reads_all_but_cannot_change_trips(client_for, accountant, world):
    c = client_for(accountant)
    assert len(c.get("/trips").json()) == 2
    tid = world["alice"]["trip"]["id"]
    assert c.get(f"/trips/{tid}").status_code == 200
    assert c.patch(f"/trips/{tid}", json={"status": "approved"}).status_code == 403
    assert c.delete(f"/trips/{tid}").status_code == 403
    assert c.post("/trips", json={"destination": "А", "start_date": "2026-12-01", "end_date": "2026-12-02", "budget_id": world["budget"]["id"]}).status_code == 403


# ---------- авансы ----------
def test_employee_sees_only_own_advances(client_for, alice, world):
    c = client_for(alice)
    assert [a["id"] for a in c.get("/advances").json()] == [world["alice"]["advance"]["id"]]
    assert c.get(f"/advances/{world['alice']['advance']['id']}").status_code == 200
    foreign = world["bob"]["advance"]["id"]
    assert c.get(f"/advances/{foreign}").status_code == 404
    assert c.patch(f"/advances/{foreign}", json={"amount": "1"}).status_code == 404
    assert c.delete(f"/advances/{foreign}").status_code == 404


def test_employee_requests_advance_only_for_own_trip(client_for, alice, world):
    c = client_for(alice)
    assert c.post("/advances", json={"trip_id": world["alice"]["trip"]["id"], "amount": "5000"}).status_code == 201
    assert c.post("/advances", json={"trip_id": world["bob"]["trip"]["id"], "amount": "5000"}).status_code == 404


def test_advance_limit_still_enforced_for_employee(client_for, alice, world):
    r = client_for(alice).post("/advances", json={"trip_id": world["alice"]["trip"]["id"], "amount": "95000"})
    assert r.status_code == 400 and "превышает" in r.json()["detail"]


def test_only_accountant_changes_advance_status(client, client_for, accountant, alice, world):
    aid = world["alice"]["advance"]["id"]
    assert client_for(alice).patch(f"/advances/{aid}", json={"status": "issued"}).status_code == 403
    assert client.patch(f"/advances/{aid}", json={"status": "issued"}).status_code == 403  # руководитель тоже
    r = client_for(accountant).patch(f"/advances/{aid}", json={"status": "issued"})
    assert r.status_code == 200 and r.json()["status"] == "issued"
    assert client_for(alice).patch(f"/advances/{aid}", json={"amount": "12000"}).status_code == 200  # сумму сотрудник менять может


# ---------- расходы ----------
def test_employee_sees_and_changes_only_own_expenses(client_for, alice, world):
    c = client_for(alice)
    assert [e["id"] for e in c.get("/expenses").json()] == [world["alice"]["expense"]["id"]]
    foreign = world["bob"]["expense"]["id"]
    assert c.get(f"/expenses/{foreign}").status_code == 404
    assert c.patch(f"/expenses/{foreign}", json={"amount": "1"}).status_code == 404
    assert c.delete(f"/expenses/{foreign}").status_code == 404
    own = world["alice"]["expense"]["id"]
    assert c.patch(f"/expenses/{own}", json={"amount": "700"}).status_code == 200


def test_employee_adds_expense_only_to_own_trip(client_for, alice, world):
    body = {"category": "meals", "description": "Ужин", "amount": "900", "expense_date": "2026-11-05"}
    c = client_for(alice)
    assert c.post("/expenses", json={**body, "trip_id": world["alice"]["trip"]["id"]}).status_code == 201
    assert c.post("/expenses", json={**body, "trip_id": world["bob"]["trip"]["id"]}).status_code == 404


def test_accountant_reads_expenses_but_cannot_change_them(client_for, accountant, world):
    c = client_for(accountant)
    assert len(c.get("/expenses").json()) == 2
    eid = world["alice"]["expense"]["id"]
    assert c.patch(f"/expenses/{eid}", json={"amount": "1"}).status_code == 403
    assert c.delete(f"/expenses/{eid}").status_code == 403


# ---------- бюджеты ----------
def test_budgets_readable_by_all_editable_by_staff(client, client_for, accountant, alice, world):
    bid = world["budget"]["id"]
    emp = client_for(alice)
    assert emp.get("/budgets").status_code == 200 and emp.get(f"/budgets/{bid}/summary").status_code == 200
    body = {"department": "Новый", "period": "2027-Q1", "limit_amount": "1000"}
    assert emp.post("/budgets", json=body).status_code == 403
    assert emp.patch(f"/budgets/{bid}", json={"limit_amount": "5"}).status_code == 403
    assert emp.delete(f"/budgets/{bid}").status_code == 403
    assert client_for(accountant).post("/budgets", json=body).status_code == 201
    assert client.patch(f"/budgets/{bid}", json={"limit_amount": "2000000"}).status_code == 200


# ---------- пользователи ----------
def test_employee_reads_and_edits_only_self(client_for, alice, bob):
    c = client_for(alice)
    assert c.get(f"/users/{alice['id']}").status_code == 200
    assert c.patch(f"/users/{alice['id']}", json={"department": "Закупки"}).json()["department"] == "Закупки"
    assert c.get(f"/users/{bob['id']}").status_code == 404
    assert c.patch(f"/users/{bob['id']}", json={"department": "Х"}).status_code == 404
    assert c.get("/users").status_code == 403
    assert c.delete(f"/users/{bob['id']}").status_code == 403


def test_role_cannot_be_raised_through_api(client_for, anon, alice):
    c = client_for(alice)
    r = c.patch(f"/users/{alice['id']}", json={"role": "manager", "is_active": False, "password_hash": "x"})
    assert r.status_code == 200 and r.json()["role"] == "employee"  # лишние поля игнорируются
    assert c.get("/auth/me").json()["role"] == "employee"
    assert c.get("/users").status_code == 403  # прав руководителя нет


def test_staff_lists_users_but_only_manager_deletes(client, client_for, accountant, bob):
    assert len(client.get("/users").json()) >= 3
    acc = client_for(accountant)
    assert acc.get("/users").status_code == 200 and acc.get(f"/users/{bob['id']}").status_code == 200
    assert acc.delete(f"/users/{bob['id']}").status_code == 403
    assert client.delete(f"/users/{bob['id']}").status_code == 204
