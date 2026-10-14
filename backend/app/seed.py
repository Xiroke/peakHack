from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Product, Region, Wave, WaveDirection, WaveStatus
from app.product_media import DEFAULT_PRODUCT_PHOTOS


PRODUCTS = (
    (Region.YAKUTIA, "Якутская хлебная компания", "Конфеты «Якутские узоры»", "Шоколадные конфеты", 250, "450.00", True, 180, "Ассорти конфет с северными ягодами."),
    (Region.YAKUTIA, "Якутская хлебная компания", "Шоколад «Ленские берега»", "Шоколад", 100, "210.00", True, 240, "Тёмный шоколад с кедровым орехом."),
    (Region.YAKUTIA, "Якутская хлебная компания", "Пряники «Полярная звезда»", "Пряники", 300, "280.00", False, 90, "Мягкие пряники с пряностями."),
    (Region.YAKUTIA, "Северный вкус", "Мармелад с брусникой", "Мармелад", 180, "320.00", False, 120, "Ягодный мармелад на основе брусники."),
    (Region.YAKUTIA, "Северный вкус", "Карамель «Таёжная»", "Карамель", 200, "190.00", False, 365, "Карамель с хвойной нотой."),
    (Region.YAKUTIA, "Якутские сладости", "Пастила с черникой", "Пастила", 150, "340.00", False, 120, "Воздушная пастила с северной черникой."),
    (Region.YAKUTIA, "Якутские сладости", "Ирис «Золотая тайга»", "Ирис", 220, "260.00", False, 240, "Сливочный ирис с мёдом."),
    (Region.YAKUTIA, "Северный вкус", "Набор «Северное сияние»", "Подарочные наборы", 500, "980.00", True, 120, "Набор сладостей с ягодными вкусами."),
    (Region.YAKUTIA, "Якутская хлебная компания", "Вафли «Алдан»", "Вафли", 180, "230.00", False, 180, "Хрустящие вафли со сливочной начинкой."),
    (Region.YAKUTIA, "Якутские сладости", "Драже с кедровым орехом", "Драже", 120, "390.00", True, 180, "Кедровый орех в шоколадной глазури."),
    (Region.DNR, "Донецкая кондитерская фабрика", "Конфеты «Донецкий вечер»", "Шоколадные конфеты", 250, "430.00", True, 180, "Ассорти шоколадных конфет."),
    (Region.DNR, "Донецкая кондитерская фабрика", "Шоколад «Шахтёрский»", "Шоколад", 90, "195.00", True, 240, "Тёмный шоколад с ореховой крошкой."),
    (Region.DNR, "Сладкий край", "Зефир «Степной»", "Зефир", 220, "270.00", False, 90, "Воздушный ванильный зефир."),
    (Region.DNR, "Сладкий край", "Печенье «Терриконы»", "Печенье", 300, "250.00", False, 180, "Песочное печенье с какао."),
    (Region.DNR, "Донецкая кондитерская фабрика", "Карамель «Рассвет»", "Карамель", 200, "175.00", False, 365, "Фруктовая карамель в яркой обёртке."),
    (Region.DNR, "Сладкий край", "Мармелад «Абрикосовый сад»", "Мармелад", 180, "290.00", False, 120, "Мармелад с натуральным абрикосовым вкусом."),
    (Region.DNR, "Донецкая кондитерская фабрика", "Набор «Тёплая встреча»", "Подарочные наборы", 450, "890.00", True, 120, "Подарочный набор с шоколадом и печеньем."),
    (Region.DNR, "Сладкий край", "Вафли «Донбасские»", "Вафли", 160, "215.00", False, 180, "Вафли с шоколадной начинкой."),
    (Region.DNR, "Донецкая кондитерская фабрика", "Драже «Угольки»", "Драже", 130, "310.00", True, 180, "Шоколадное драже в тёмной глазури."),
    (Region.DNR, "Сладкий край", "Пряники «Домашние»", "Пряники", 350, "300.00", False, 90, "Медовые пряники с корицей."),
)


def seed_data(session: Session) -> None:
    if session.scalar(select(func.count()).select_from(Product)) == 0:
        session.add_all(
            Product(
                region=region,
                manufacturer=manufacturer,
                name=name,
                category=category,
                weight_g=weight_g,
                price_rub=Decimal(price),
                temp_sensitive=temp_sensitive,
                shelf_life_days=shelf_life_days,
                photo=DEFAULT_PRODUCT_PHOTOS.get(index),
                description=description,
                is_active=True,
            )
            for index, (region, manufacturer, name, category, weight_g, price, temp_sensitive, shelf_life_days, description) in enumerate(PRODUCTS, start=1)
        )

    if session.scalar(select(func.count()).select_from(Wave)) == 0:
        first_dispatch = date.today() + timedelta(days=10)
        for number in range(3):
            dispatch_date = first_dispatch + timedelta(days=14 * number)
            for direction in WaveDirection:
                session.add(
                    Wave(
                        direction=direction,
                        dispatch_date=dispatch_date,
                        order_deadline=dispatch_date - timedelta(days=3),
                        min_weight_kg=50,
                        max_weight_kg=300,
                        status=WaveStatus.OPEN,
                    )
                )

    session.commit()


def main() -> None:
    with SessionLocal() as session:
        seed_data(session)
    print("Демонстрационные товары и волны добавлены.")


if __name__ == "__main__":
    main()
