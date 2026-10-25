"""Служебные команды. Пример: создать руководителя для демонстрации.

    $env:NEW_USER_PASSWORD = "<пароль, не короче 8 символов>"
    python -m app.cli create-user --email manager@example.com --full-name "Руководитель" --role manager

Если переменная NEW_USER_PASSWORD не задана, пароль запрашивается при запуске (ввод не отображается).
Роли manager и accountant назначить через API нельзя, только этой командой (или прямым изменением в БД).
"""
import argparse
import getpass
import os
import sys

from pydantic import ValidationError

from app import crud, models, schemas, security
from app.db import Base, SessionLocal, engine


def create_user(args: argparse.Namespace) -> int:
    password = os.environ.get("NEW_USER_PASSWORD") or getpass.getpass("Пароль: ")
    try:
        data = schemas.UserRegister(full_name=args.full_name, email=args.email, password=password, department=args.department)
    except ValidationError as exc:
        print("Некорректные данные:", "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()), file=sys.stderr)
        return 2
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        try:
            user = crud.create_user(db, data, security.hash_password(password), models.Role(args.role))
        except crud.ConflictError as exc:
            print(exc, file=sys.stderr)
            return 1
    print(f"Создан пользователь id={user.id}, {user.email}, роль {user.role.value}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-user", help="создать пользователя с указанной ролью")
    p.add_argument("--email", required=True)
    p.add_argument("--full-name", required=True)
    p.add_argument("--role", choices=[r.value for r in models.Role], default="employee")
    p.add_argument("--department")
    p.set_defaults(func=create_user)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
