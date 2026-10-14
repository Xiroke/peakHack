import { productImageUrl, type Product } from '../lib/api'
import { AppLink } from '../lib/router'

function formatPrice(value: string) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value))} ₽`
}

type ProductCardProps = {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <AppLink className="product-card" to={`/products/${product.id}`}>
      {product.photo ? (
        <img className="product-card__image" src={productImageUrl(product.photo)} alt={product.name} />
      ) : (
        <div className="product-card__placeholder" aria-hidden="true">
          {product.category}
        </div>
      )}
      <div className="product-card__body">
        <p className="product-card__manufacturer">{product.manufacturer}</p>
        <h2>{product.name}</h2>
        <p className="product-card__details">
          {product.category} · {product.weight_g} г
        </p>
        {product.temp_sensitive && <p className="temperature-note">Требует бережной перевозки</p>}
        <div className="product-card__footer">
          <strong>{formatPrice(product.price_rub)}</strong>
          <span>Подробнее →</span>
        </div>
      </div>
    </AppLink>
  )
}
