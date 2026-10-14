import { PageContainer } from '../components/PageContainer'
import { AppLink } from '../lib/router'

const storefronts = [
  {
    region: 'Якутия',
    description: 'Северные ягоды, шоколад и подарочные наборы от производителей республики.',
    to: '/catalog?region=yakutia',
  },
  {
    region: 'Донбасс',
    description: 'Знакомые вкусы и кондитерские изделия от производителей региона.',
    to: '/catalog?region=dnr',
  },
]

export function HomePage() {
  return (
    <PageContainer>
      <section className="hero-section" aria-labelledby="hero-title">
        <p className="eyebrow">Маркетплейс региональных сладостей</p>
        <h1 id="hero-title">Сладости, которые соединяют регионы</h1>
        <p className="hero-section__lead">
          Заказывайте фирменные изделия Якутии и Донбасса для себя или в подарок. Заказы отправляются
          сборными партиями — так доставка становится выгоднее.
        </p>
      </section>

      <section className="storefront-section" aria-labelledby="storefronts-title">
        <div className="section-heading">
          <p className="eyebrow">Выберите направление</p>
          <h2 id="storefronts-title">Две витрины — один маршрут</h2>
        </div>

        <div className="storefront-list">
          {storefronts.map(({ region, description, to }) => (
            <AppLink className="storefront-link" key={region} to={to}>
              <span className="storefront-link__region">Сладости {region}</span>
              <span className="storefront-link__description">{description}</span>
              <span className="storefront-link__action" aria-hidden="true">Открыть витрину →</span>
            </AppLink>
          ))}
        </div>
      </section>

      <section className="how-it-works" aria-labelledby="how-it-works-title">
        <div>
          <p className="eyebrow">Как это работает</p>
          <h2 id="how-it-works-title">Заказ собирается в общую отправку</h2>
        </div>
        <ol>
          <li>Выберите товары из нужной региональной витрины.</li>
          <li>Присоединитесь к ближайшей «волне» доставки.</li>
          <li>Получите заказ в своём регионе или отправьте его в подарок.</li>
        </ol>
      </section>
    </PageContainer>
  )
}
