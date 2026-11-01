"""Фильтры списков на сервере (ЛР №5): поиск и отбор выполняет backend, а не интерфейс."""


def test_trip_search_by_destination_purpose_and_employee(client, make_user, make_budget, make_trip):
    budget = make_budget()
    petrova = make_user(name="Петрова Анна")
    make_trip(user=petrova, budget=budget, destination="Казань", purpose="Конференция")
    make_trip(user=make_user(), budget=budget, destination="Сочи", purpose="Обучение")

    def found(q):
        return [t["destination"] for t in client.get("/trips", params={"q": q}).json()]

    assert found("каз") == ["Казань"]  # без учёта регистра
    assert found("обуч") == ["Сочи"]  # по цели
    assert found("петрова") == ["Казань"]  # по ФИО сотрудника
    assert found("zzz") == []


def test_trip_search_escapes_like_wildcards(client, make_trip):
    make_trip(destination="Казань")
    assert client.get("/trips", params={"q": "%"}).json() == []
    assert client.get("/trips", params={"q": "_"}).json() == []


def test_trip_search_combines_with_status_and_owner(client_for, client, create_user, make_budget, make_trip):
    alice = create_user("employee", "alice@example.com", "Алиса")
    budget = make_budget()
    own = make_trip(user=alice, budget=budget, destination="Казань")
    make_trip(budget=budget, destination="Казань")  # чужая
    client.patch(f"/trips/{own['id']}", json={"status": "pending"})

    c = client_for(alice)
    assert [t["id"] for t in c.get("/trips", params={"q": "казань"}).json()] == [own["id"]]
    assert c.get("/trips", params={"q": "казань", "status": "draft"}).json() == []


def test_trip_search_length_limited(client):
    assert client.get("/trips", params={"q": "я" * 101}).status_code == 422


def test_advance_status_filter(client, make_trip, accountant, client_for):
    trip = make_trip("100000.00")
    a1 = client.post("/advances", json={"trip_id": trip["id"], "amount": "1000"}).json()
    client.post("/advances", json={"trip_id": trip["id"], "amount": "2000"})
    client_for(accountant).patch(f"/advances/{a1['id']}", json={"status": "issued"})

    assert [a["id"] for a in client.get("/advances", params={"status": "issued"}).json()] == [a1["id"]]
    assert len(client.get("/advances", params={"status": "requested"}).json()) == 1
    assert client.get("/advances", params={"status": "bogus"}).status_code == 422


def test_expense_category_and_search_filters(client, make_trip):
    trip = make_trip()
    for category, description in (("meals", "Обед в кафе"), ("transport", "Такси до аэропорта"), ("meals", "Ужин")):
        r = client.post(
            "/expenses",
            json={"trip_id": trip["id"], "category": category, "description": description, "amount": "100", "expense_date": "2026-11-04"},
        )
        assert r.status_code == 201

    def found(**params):
        return sorted(e["description"] for e in client.get("/expenses", params=params).json())

    assert found(category="meals") == ["Обед в кафе", "Ужин"]
    assert found(q="такси") == ["Такси до аэропорта"]
    assert found(category="meals", q="обед") == ["Обед в кафе"]
    assert client.get("/expenses", params={"category": "bogus"}).status_code == 422


def test_budget_summary_money_always_has_two_decimals(client, make_budget):
    budget = make_budget("1000.00")
    s = client.get(f"/budgets/{budget['id']}/summary").json()
    assert s["reserved"] == "0.00"  # раньше было "0": frontend ожидает единый формат денег
    assert s["remaining"] == "1000.00"
