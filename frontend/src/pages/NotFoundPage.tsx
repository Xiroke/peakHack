import { PageContainer } from '../components/PageContainer'
import { AppLink } from '../lib/router'

export function NotFoundPage() {
  return (
    <PageContainer>
      <section className="placeholder-page" aria-labelledby="not-found-title">
        <p className="eyebrow">Ошибка 404</p>
        <h1 id="not-found-title">Страница не найдена</h1>
        <p>Проверьте адрес или вернитесь к выбору региональной витрины.</p>
        <AppLink className="text-link" to="/catalog">
          Перейти в каталог
        </AppLink>
      </section>
    </PageContainer>
  )
}
