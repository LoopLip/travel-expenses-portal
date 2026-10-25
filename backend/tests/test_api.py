"""Проверки CRUD, валидации, кодов ответов и связанных записей."""


# ---------- users ----------
def test_user_read_update_delete(client, make_user):
    user = make_user("Anna@Example.com", "Петрова Анна")
    assert user["email"] == "Anna@Example.com"  # создан напрямую в БД
    assert client.get(f"/users/{user['id']}").json()["full_name"] == "Петрова Анна"

    r = client.patch(f"/users/{user['id']}", json={"department": "Разработка", "email": " Anna2@Example.com "})
    assert r.status_code == 200
    assert r.json()["department"] == "Разработка"
    assert r.json()["email"] == "anna2@example.com"  # email нормализован
    assert "password_hash" not in r.json()

    assert client.delete(f"/users/{user['id']}").status_code == 204
    assert client.get(f"/users/{user['id']}").status_code == 404


def test_user_update_to_taken_email_conflict(client, make_user):
    make_user("a@example.com")
    b = make_user("b@example.com")
    assert client.patch(f"/users/{b['id']}", json={"email": "a@example.com"}).status_code == 409
    # собственный email повторно — не конфликт
    assert client.patch(f"/users/{b['id']}", json={"email": "b@example.com"}).status_code == 200


def test_not_found_has_message(client):
    r = client.get("/users/9999")
    assert r.status_code == 404
    assert "не найден" in r.json()["detail"]
    assert client.patch("/users/9999", json={"full_name": "X"}).status_code == 404
    assert client.delete("/users/9999").status_code == 404


def test_patch_rejects_null_for_required_field(client, make_user):
    user = make_user()
    assert client.patch(f"/users/{user['id']}", json={"full_name": None}).status_code == 422
    # а обнулить необязательное поле можно
    assert client.patch(f"/users/{user['id']}", json={"department": None}).json()["department"] is None


# ---------- budgets ----------
def test_budget_crud_and_validation(client):
    r = client.post("/budgets", json={"department": "Маркетинг", "period": "2026, Q4", "limit_amount": "200000"})
    assert r.status_code == 201
    bid = r.json()["id"]
    assert client.post("/budgets", json={"department": "X", "period": "Q", "limit_amount": "0"}).status_code == 422
    assert client.post("/budgets", json={"department": "X", "period": "Q", "limit_amount": "-5"}).status_code == 422

    r = client.patch(f"/budgets/{bid}", json={"limit_amount": "250000.50"})
    assert r.json()["limit_amount"] == "250000.50"
    assert client.delete(f"/budgets/{bid}").status_code == 204


def test_budget_summary_counts_only_active_trips(client, make_user, make_budget, make_trip):
    user, budget = make_user(), make_budget("300000.00")
    make_trip("100000.00", user=user, budget=budget)  # draft — не резервирует
    t2 = make_trip("50000.00", user=user, budget=budget)
    client.patch(f"/trips/{t2['id']}", json={"status": "approved"})

    s = client.get(f"/budgets/{budget['id']}/summary").json()
    assert s["reserved"] == "50000.00"
    assert s["remaining"] == "250000.00"


# ---------- trips ----------
def test_trip_crud(client, make_trip):
    trip = make_trip()
    assert trip["status"] == "draft"
    assert client.get("/trips").json()[0]["id"] == trip["id"]

    r = client.patch(f"/trips/{trip['id']}", json={"status": "pending", "destination": "Сочи"})
    assert r.status_code == 200
    assert r.json()["status"] == "pending" and r.json()["destination"] == "Сочи"

    assert client.delete(f"/trips/{trip['id']}").status_code == 204
    assert client.get(f"/trips/{trip['id']}").status_code == 404


def test_trip_filters(client, make_user, make_budget, make_trip):
    user, budget = make_user(), make_budget()
    t1 = make_trip(user=user, budget=budget)
    make_trip(user=user, budget=budget)
    client.patch(f"/trips/{t1['id']}", json={"status": "approved"})

    assert len(client.get("/trips", params={"status": "approved"}).json()) == 1
    assert len(client.get("/trips", params={"user_id": user["id"]}).json()) == 2
    assert client.get("/trips", params={"status": "bogus"}).status_code == 422


def test_trip_invalid_dates_422_on_create(client, make_user, make_budget):
    r = client.post(
        "/trips",
        json={
            "destination": "Москва", "start_date": "2026-11-10", "end_date": "2026-11-01",
            "user_id": make_user()["id"], "budget_id": make_budget()["id"],
        },
    )
    assert r.status_code == 422


def test_trip_invalid_dates_400_on_update(client, make_trip):
    trip = make_trip()
    r = client.patch(f"/trips/{trip['id']}", json={"end_date": "2026-11-01"})
    assert r.status_code == 400
    assert "раньше" in r.json()["detail"]


def test_trip_unknown_references_404(client, make_user, make_budget):
    base = {"destination": "Москва", "start_date": "2026-11-01", "end_date": "2026-11-02"}
    r = client.post("/trips", json={**base, "user_id": 999, "budget_id": make_budget()["id"]})
    assert r.status_code == 404 and "Пользователь" in r.json()["detail"]
    r = client.post("/trips", json={**base, "user_id": make_user()["id"], "budget_id": 999})
    assert r.status_code == 404 and "Бюджет" in r.json()["detail"]


def test_trip_detail_contains_related(client, make_trip):
    trip = make_trip()
    client.post("/advances", json={"trip_id": trip["id"], "amount": "10000"})
    client.post(
        "/expenses",
        json={"trip_id": trip["id"], "category": "transport", "description": "Билеты", "amount": "5000", "expense_date": "2026-11-03"},
    )
    detail = client.get(f"/trips/{trip['id']}").json()
    assert len(detail["advances"]) == 1 and len(detail["expenses"]) == 1


# ---------- связи и ограничения ----------
def test_delete_trip_cascades_to_advances_and_expenses(client, make_trip):
    trip = make_trip()
    adv = client.post("/advances", json={"trip_id": trip["id"], "amount": "10000"}).json()
    exp = client.post(
        "/expenses",
        json={"trip_id": trip["id"], "category": "meals", "description": "Обед", "amount": "900", "expense_date": "2026-11-04"},
    ).json()

    assert client.delete(f"/trips/{trip['id']}").status_code == 204
    assert client.get(f"/advances/{adv['id']}").status_code == 404
    assert client.get(f"/expenses/{exp['id']}").status_code == 404


def test_cannot_delete_user_or_budget_with_trips(client, make_user, make_budget, make_trip):
    user, budget = make_user(), make_budget()
    make_trip(user=user, budget=budget)
    r = client.delete(f"/users/{user['id']}")
    assert r.status_code == 409 and "командировки" in r.json()["detail"]
    r = client.delete(f"/budgets/{budget['id']}")
    assert r.status_code == 409 and "командировки" in r.json()["detail"]
    # данные не пострадали
    assert client.get(f"/users/{user['id']}").status_code == 200


def test_trip_delete_frees_user_and_budget(client, make_user, make_budget, make_trip):
    user, budget = make_user(), make_budget()
    trip = make_trip(user=user, budget=budget)
    client.delete(f"/trips/{trip['id']}")
    assert client.delete(f"/users/{user['id']}").status_code == 204
    assert client.delete(f"/budgets/{budget['id']}").status_code == 204


# ---------- advances ----------
def test_advance_crud_and_limit(client, make_trip, accountant, client_for):
    trip = make_trip("60000.00")
    r = client.post("/advances", json={"trip_id": trip["id"], "amount": "40000"})
    assert r.status_code == 201 and r.json()["status"] == "requested"
    aid = r.json()["id"]

    # суммарно 40000 + 30000 > 60000
    r = client.post("/advances", json={"trip_id": trip["id"], "amount": "30000"})
    assert r.status_code == 400 and "превышает" in r.json()["detail"]

    # статус аванса меняет только бухгалтер
    assert client_for(accountant).patch(f"/advances/{aid}", json={"status": "issued"}).json()["status"] == "issued"
    assert client.patch(f"/advances/{aid}", json={"amount": "70000"}).status_code == 400
    assert client.patch(f"/advances/{aid}", json={"amount": "60000"}).status_code == 200  # свой аванс не считается дважды

    assert client.delete(f"/advances/{aid}").status_code == 204


def test_advance_validation_and_missing_trip(client, make_trip):
    trip = make_trip()
    assert client.post("/advances", json={"trip_id": trip["id"], "amount": "0"}).status_code == 422
    assert client.post("/advances", json={"trip_id": trip["id"], "amount": "10.123"}).status_code == 422
    r = client.post("/advances", json={"trip_id": 999, "amount": "100"})
    assert r.status_code == 404 and "Командировка" in r.json()["detail"]


def test_cannot_lower_planned_amount_below_advances(client, make_trip):
    trip = make_trip("50000.00")
    client.post("/advances", json={"trip_id": trip["id"], "amount": "40000"})
    assert client.patch(f"/trips/{trip['id']}", json={"planned_amount": "30000"}).status_code == 400


# ---------- expenses ----------
def test_expense_crud(client, make_trip):
    trip = make_trip()
    payload = {"trip_id": trip["id"], "category": "lodging", "description": "Отель", "amount": "12000.50", "expense_date": "2026-11-03"}
    r = client.post("/expenses", json=payload)
    assert r.status_code == 201
    eid = r.json()["id"]
    assert r.json()["receipt_url"] is None

    r = client.patch(f"/expenses/{eid}", json={"receipt_url": "receipts/1.jpg", "amount": "13000"})
    assert r.json()["receipt_url"] == "receipts/1.jpg" and r.json()["amount"] == "13000.00"

    assert len(client.get("/expenses", params={"trip_id": trip["id"]}).json()) == 1
    assert client.delete(f"/expenses/{eid}").status_code == 204
    assert client.get("/expenses").json() == []


def test_expense_validation(client, make_trip):
    trip = make_trip()
    base = {"trip_id": trip["id"], "category": "meals", "description": "Обед", "amount": "500", "expense_date": "2026-11-03"}
    assert client.post("/expenses", json={**base, "category": "yacht"}).status_code == 422
    assert client.post("/expenses", json={**base, "amount": "-1"}).status_code == 422
    assert client.post("/expenses", json={**base, "expense_date": "31.02.2026"}).status_code == 422
    assert client.post("/expenses", json={**base, "trip_id": 999}).status_code == 404


def test_pagination_params_validated(client):
    assert client.get("/users", params={"limit": 0}).status_code == 422
    assert client.get("/users", params={"skip": -1}).status_code == 422


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}
