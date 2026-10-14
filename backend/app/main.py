from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.admin import router as admin_router
from app.api.health import router as health_router
from app.api.orders import router as orders_router
from app.api.products import router as products_router
from app.api.waves import router as waves_router
from app.config import settings
from app.product_media import PRODUCT_IMAGES_DIRECTORY, PRODUCT_IMAGES_URL_PREFIX

PRODUCT_IMAGES_DIRECTORY.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Сладкий мост API",
    summary="API маркетплейса кондитерских изделий между Якутией и ДНР",
    version="0.1.0",
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, error: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Некорректные данные запроса.",
                "details": [
                    {"loc": list(item["loc"]), "msg": item["msg"], "type": item["type"]}
                    for item in error.errors()
                ],
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_error_handler(_: Request, error: HTTPException) -> JSONResponse:
    message = error.detail if isinstance(error.detail, str) else "Не удалось выполнить запрос."
    return JSONResponse(
        status_code=error.status_code,
        content={"error": {"code": "http_error", "message": message}},
    )


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "internal_error", "message": "Внутренняя ошибка сервера."}},
    )


app.mount(PRODUCT_IMAGES_URL_PREFIX, StaticFiles(directory=PRODUCT_IMAGES_DIRECTORY), name="product-images")

app.include_router(admin_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(products_router, prefix="/api")
app.include_router(waves_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
